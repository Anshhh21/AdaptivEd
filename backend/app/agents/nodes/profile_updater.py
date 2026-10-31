import logging
from typing import Dict
from app.agents.state import LearnerAgentState
from app.models.learner import LearnerProfile

logger = logging.getLogger("adaptived.agents.profile_updater")


async def profile_updater_node(state: LearnerAgentState) -> Dict[str, object]:
    """
    ProfileUpdaterNode (Second node in LangGraph loop).
    Dynamically adjusts the learner's cognitive baseline, awards XP, and updates streak consistency.
    Uses Bayesian exponential moving average (EMA) to prevent wild WPM baseline swings.
    """
    node_name = "ProfileUpdaterNode"
    trace = list(state.get("node_trace", []))
    trace.append(node_name)

    learner_id = state.get("learner_id")
    cur_eval = state.get("current_evaluation", {})
    cur_tick = state.get("current_tick", {})
    bcs_score = float(cur_eval.get("score", 0.75))
    active_dwell_ms = int(cur_tick.get("active_dwell_time_ms", 0))
    target_dwell_ms = int(state.get("target_dwell_ms", 25000))
    decision = state.get("decision", "CONTINUE")

    # Only update database profile if valid learner_id is provided
    if learner_id and learner_id != "anonymous":
        try:
            profile = await LearnerProfile.find_one(LearnerProfile.user_id == learner_id)
            if profile:
                # 1. Bayesian WPM update if student spent meaningful dwell time (>5s)
                if active_dwell_ms > 5000 and bcs_score >= 0.70:
                    observed_wpm = (
                        (int(state.get("flesch_kincaid_grade", 8)) * 15)  # estimate words
                        / (active_dwell_ms / 60000.0)
                    )
                    # Bound observed WPM to realistic limits
                    bounded_wpm = max(100.0, min(500.0, observed_wpm))
                    alpha = 0.08  # Gradual Bayesian learning rate
                    new_wpm = (alpha * bounded_wpm) + ((1.0 - alpha) * profile.baseline.wpm)
                    profile.baseline.wpm = round(new_wpm, 1)

                # 2. XP gamification allocation
                xp_gain = 0
                if bcs_score >= 0.80:
                    xp_gain = 25  # High comprehension bonus
                elif bcs_score >= 0.65:
                    xp_gain = 10  # Standard progress

                if xp_gain > 0:
                    profile.total_xp += xp_gain

                # 3. Dynamic Learning Velocity (ELV)
                profile.effective_learning_velocity = round(
                    max(0.5, min(2.5, profile.effective_learning_velocity * 0.95 + (bcs_score * 0.05))),
                    3,
                )

                await profile.save()
                logger.info(
                    f"Profile updated for {learner_id}: +{xp_gain} XP, WPM={profile.baseline.wpm}, ELV={profile.effective_learning_velocity}"
                )
        except Exception as exc:
            logger.error(f"Failed to update LearnerProfile for {learner_id}: {exc}")

    return {
        "node_trace": trace,
    }

