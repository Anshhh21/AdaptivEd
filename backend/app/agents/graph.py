import logging
from typing import Any, Dict
from app.agents.nodes.adapter import content_adapter_node
from app.agents.nodes.evaluator import telemetry_evaluator_node
from app.agents.nodes.profile_updater import profile_updater_node
from app.agents.nodes.quiz import micro_quiz_node
from app.agents.nodes.router import pedagogical_router_node, route_pedagogical_decision
from app.agents.state import LearnerAgentState

logger = logging.getLogger("adaptived.agents.graph")


class AdaptivEdStateGraphRunner:
    """
    Deterministic async execution pipeline for the AdaptivEd Multi-Agent Loop.
    Executes:
    1. TelemetryEvaluatorNode ->
    2. ProfileUpdaterNode ->
    3. PedagogicalRouterNode ->
       - If 'adapter' -> ContentAdapterNode -> END
       - If 'quiz'    -> MicroQuizNode -> END
       - If 'end'     -> END
    """

    @classmethod
    async def run_cycle(cls, initial_state: LearnerAgentState) -> LearnerAgentState:
        state: Dict[str, Any] = dict(initial_state)

        # Node 1: TelemetryEvaluatorNode
        eval_update = telemetry_evaluator_node(state)
        state.update(eval_update)

        # Node 2: ProfileUpdaterNode
        profile_update = await profile_updater_node(state)
        state.update(profile_update)

        # Node 3: PedagogicalRouterNode
        router_update = pedagogical_router_node(state)
        state.update(router_update)

        # Conditional Edge Evaluation
        branch = route_pedagogical_decision(state)

        if branch == "adapter":
            adapter_update = await content_adapter_node(state)
            state.update(adapter_update)
        elif branch == "quiz":
            quiz_update = await micro_quiz_node(state)
            state.update(quiz_update)
        elif branch == "end":
            pass

        return state  # type: ignore[return-value]


def build_langgraph_workflow():
    """
    Constructs and compiles the official LangGraph StateGraph instance if langgraph is available.
    """
    try:
        from langgraph.graph import END, StateGraph

        workflow = StateGraph(LearnerAgentState)

        # Register nodes
        workflow.add_node("evaluator", telemetry_evaluator_node)
        workflow.add_node("updater", profile_updater_node)
        workflow.add_node("router", pedagogical_router_node)
        workflow.add_node("adapter", content_adapter_node)
        workflow.add_node("quiz", micro_quiz_node)

        # Set entry point & linear edges
        workflow.set_entry_point("evaluator")
        workflow.add_edge("evaluator", "updater")
        workflow.add_edge("updater", "router")

        # Conditional branching from router
        workflow.add_conditional_edges(
            "router",
            route_pedagogical_decision,
            {
                "adapter": "adapter",
                "quiz": "quiz",
                "end": END,
            },
        )

        workflow.add_edge("adapter", END)
        workflow.add_edge("quiz", END)

        return workflow.compile()
    except ImportError:
        logger.warning(
            "langgraph library not installed in runtime environment; using pure async AdaptivEdStateGraphRunner."
        )
        return None


# Compiled global graph instance
compiled_graph = build_langgraph_workflow()


async def execute_agent_loop(state: LearnerAgentState) -> LearnerAgentState:
    """
    Unified public interface to execute one multi-agent cognitive cycle.
    Delegates to compiled LangGraph if installed, or the high-speed async runner.
    """
    if compiled_graph is not None:
        try:
            result = await compiled_graph.ainvoke(state)
            return result
        except Exception as exc:
            logger.error(f"LangGraph execution exception: {exc}. Delegating to runner.")

    return await AdaptivEdStateGraphRunner.run_cycle(state)

