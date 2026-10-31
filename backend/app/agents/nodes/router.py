import logging
from typing import Dict, Literal
from app.agents.state import LearnerAgentState

logger = logging.getLogger("adaptived.agents.router")


def pedagogical_router_node(state: LearnerAgentState) -> Dict[str, object]:
    """
    PedagogicalRouterNode (Third node in LangGraph loop).
    Inspects the cognitive diagnosis and prepares conditional edge evaluation.
    """
    node_name = "PedagogicalRouterNode"
    trace = list(state.get("node_trace", []))
    trace.append(node_name)

    decision = state.get("decision", "CONTINUE")
    logger.info(f"PedagogicalRouter evaluated decision: '{decision}' for chunk {state.get('chunk_id')}")

    return {
        "node_trace": trace,
    }


def route_pedagogical_decision(
    state: LearnerAgentState,
) -> Literal["adapter", "quiz", "end"]:
    """
    LangGraph Conditional Edge function.
    Directs graph flow based on the diagnosed cognitive state:
    - 'ADAPT_OVERLOAD'       -> routes to ContentAdapterNode
    - 'TRIGGER_SPEED_CHECK'  -> routes to MicroQuizNode
    - 'CONTINUE' / other    -> routes to END
    """
    decision = state.get("decision", "CONTINUE")

    if decision == "ADAPT_OVERLOAD":
        return "adapter"
    elif decision == "TRIGGER_SPEED_CHECK":
        return "quiz"
    else:
        return "end"

