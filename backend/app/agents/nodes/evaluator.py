import logging
from typing import Dict, List
from app.agents.state import LearnerAgentState, PedagogicalDecision

logger = logging.getLogger("adaptived.agents.evaluator")


def telemetry_evaluator_node(state: LearnerAgentState) -> Dict[str, object]:
    """
    TelemetryEvaluatorNode (First node in LangGraph loop).
    Diagnoses longitudinal cognitive trend from the sliding window of telemetry evaluations.
    Distinguishes transient pauses from sustained cognitive overload or chronic skimming.
    """
    node_name = "TelemetryEvaluatorNode"
    trace = list(state.get("node_trace", []))
    trace.append(node_name)

    cur_eval = state.get("current_evaluation", {})
    cur_score = float(cur_eval.get("score", 0.75))
    cur_state = cur_eval.get("cognitive_state", "NEUTRAL")
    requires_adapt = bool(cur_eval.get("requires_adaptation", False))
    requires_check = bool(cur_eval.get("requires_speed_check", False))

    # Maintain sliding window of last 5 evaluations
    history: List[Dict[str, object]] = list(state.get("telemetry_history", []))
    history.append(cur_eval)
    if len(history) > 5:
        history = history[-5:]

    # Compute longitudinal window statistics
    scores = [float(h.get("score", 0.75)) for h in history]
    window_mean = sum(scores) / len(scores) if scores else cur_score
    comprehension_drift = cur_score - window_mean

    # Track sustained cognitive states across consecutive ticks
    sustained_overload = int(state.get("sustained_overload_seconds", 0))
    sustained_skimming = int(state.get("sustained_skimming_seconds", 0))

    if cur_state == "OVERLOADED" or requires_adapt:
        sustained_overload += 1
    else:
        sustained_overload = max(0, sustained_overload - 1)

    if cur_state == "SKIMMING" or requires_check:
        sustained_skimming += 1
    else:
        sustained_skimming = max(0, sustained_skimming - 1)

    # Determine pedagogical routing decision
    decision: PedagogicalDecision = "CONTINUE"

    if sustained_overload >= 3 or requires_adapt:
        decision = "ADAPT_OVERLOAD"
        logger.info(
            f"Learner {state.get('learner_id')} diagnosed with sustained OVERLOAD ({sustained_overload}s). Routing to ContentAdapter."
        )
    elif sustained_skimming >= 2 or requires_check:
        decision = "TRIGGER_SPEED_CHECK"
        logger.info(
            f"Learner {state.get('learner_id')} diagnosed with SKIMMING ({sustained_skimming}s). Routing to MicroQuiz."
        )
    elif cur_score >= 0.85 and cur_state == "OPTIMAL":
        decision = "UPDATE_BASELINE"
        logger.info(
            f"Learner {state.get('learner_id')} achieving high mastery ({cur_score:.2f}). Flagged for baseline calibration."
        )

    return {
        "telemetry_history": history,
        "window_mean_bcs": round(window_mean, 4),
        "comprehension_drift": round(comprehension_drift, 4),
        "sustained_overload_seconds": sustained_overload,
        "sustained_skimming_seconds": sustained_skimming,
        "decision": decision,
        "node_trace": trace,
    }

