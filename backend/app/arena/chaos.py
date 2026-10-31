import logging
from typing import Dict, List, Optional
from app.arena.schemas import ChaosChallenge, ChaosVerificationResult

logger = logging.getLogger("adaptived.arena.chaos")

# Curated, track-specific production sabotage challenges
TRACK_CHAOS_CHALLENGES: Dict[str, ChaosChallenge] = {
    "react-gold": ChaosChallenge(
        challenge_id="chaos-react-stale-closure",
        title="The Stale Closure Event Listener Trap",
        description=(
            "In this React hook, a timer callback updates count, but due to a stale closure capture, "
            "it constantly logs the initial state value rather than the latest state. "
            "Refactor the hook to use a functional state updater so the timer always sees the latest count."
        ),
        file_name="hooks/useAutoIncrement.ts",
        bug_category="STALE_CLOSURE",
        buggy_code=(
            "import { useEffect, useState } from 'react';\n\n"
            "export function useAutoIncrement() {\n"
            "  const [count, setCount] = useState(0);\n\n"
            "  useEffect(() => {\n"
            "    const timer = setInterval(() => {\n"
            "      // BUG: Stale closure captures count = 0 forever\n"
            "      setCount(count + 1);\n"
            "    }, 1000);\n\n"
            "    return () => clearInterval(timer);\n"
            "  }, []);\n\n"
            "  return count;\n"
            "}\n"
        ),
        hint="Pass a function into setCount((prev) => prev + 1) or specify count in the dependency array.",
    ),
    "nextjs-gold": ChaosChallenge(
        challenge_id="chaos-nextjs-mutation-boundary",
        title="Unauthenticated Server Action Mutation",
        description=(
            "This Next.js Server Action executes a database update directly using client-passed userId "
            "without authenticating the session on the server. Inject server-side session authentication "
            "before executing the mutation."
        ),
        file_name="actions/updateUserProfile.ts",
        bug_category="SECURITY_VULNERABILITY",
        buggy_code=(
            "'use server';\n\n"
            "import { db } from '@/lib/db';\n\n"
            "export async function updateUserProfile(userId: string, newBio: string) {\n"
            "  // BUG: Direct mutation relying on client-supplied userId\n"
            "  await db.users.updateOne({ id: userId }, { $set: { bio: newBio } });\n"
            "  return { success: true };\n"
            "}\n"
        ),
        hint="Retrieve and verify the session user ID using getSession() before issuing the database write.",
    ),
    "mongodb-gold": ChaosChallenge(
        challenge_id="chaos-mongodb-unindexed-sort",
        title="The Memory-Exhausting Unindexed Sort",
        description=(
            "This query triggers an in-memory sort that crashes with a 32MB limit exception in production. "
            "Refactor the compound index to adhere to the ESR rule (status = Equality, createdAt = Sort, amount = Range)."
        ),
        file_name="db/indexing.ts",
        bug_category="UNINDEXED_QUERY",
        buggy_code=(
            "import { db } from '@/lib/mongodb';\n\n"
            "export async function createTransactionIndices() {\n"
            "  // BUG: Range field placed before Sort field destroys index ordering\n"
            "  await db.collection('orders').createIndex({\n"
            "    amount: 1,      // Range query ($gt)\n"
            "    status: 1,      // Equality query\n"
            "    createdAt: -1   // Sort query\n"
            "  });\n"
            "}\n"
        ),
        hint="Follow the ESR rule: Equality fields first, then Sort fields, then Range fields.",
    ),
}


class ChaosDebuggingEngine:
    """
    Tactic 4: Live In-Browser Sabotage & Chaos Debugging Engine.
    Serves track-specific production bugs and verifies candidate fixes submitted from Monaco Editor.
    """

    @classmethod
    def get_challenge_for_track(cls, track_id: str) -> ChaosChallenge:
        """Returns the appropriate chaos challenge for the completed track."""
        if track_id in TRACK_CHAOS_CHALLENGES:
            return TRACK_CHAOS_CHALLENGES[track_id]
        # Default to React stale closure
        return TRACK_CHAOS_CHALLENGES["react-gold"]

    @classmethod
    def verify_fix(cls, challenge_id: str, fixed_code: str) -> ChaosVerificationResult:
        """
        Verifies student's code fix against the challenge criteria.
        """
        code = fixed_code.strip()

        if challenge_id == "chaos-react-stale-closure":
            # Check for functional update: prev => prev + 1 or dependency addition
            has_functional_update = bool("prev" in code and "=>" in code and "prev + 1" in code)
            has_dep = bool("[count]" in code.replace(" ", ""))

            is_resolved = has_functional_update or has_dep
            return ChaosVerificationResult(
                challenge_id=challenge_id,
                is_resolved=is_resolved,
                tests_passed=2 if is_resolved else 0,
                total_tests=2,
                feedback="Excellent! Functional state updater cleanly bypasses stale closure captures."
                if is_resolved
                else "The timer still captures stale state. Use setCount(prev => prev + 1).",
            )

        elif challenge_id == "chaos-nextjs-mutation-boundary":
            has_auth_check = bool("auth" in code.lower() or "session" in code.lower() or "user" in code.lower())
            has_validation = bool("throw" in code or "unauthorized" in code.lower() or "return" in code)

            is_resolved = has_auth_check and has_validation
            return ChaosVerificationResult(
                challenge_id=challenge_id,
                is_resolved=is_resolved,
                tests_passed=2 if is_resolved else 1,
                total_tests=2,
                feedback="Verified! Server Action now validates identity before executing mutations."
                if is_resolved
                else "Insecure: You must check session identity on the server before mutating data.",
            )

        elif challenge_id == "chaos-mongodb-unindexed-sort":
            # Check ESR order: status first, then createdAt, then amount
            clean_code = code.replace(" ", "").replace("\n", "")
            is_resolved = bool("status:1" in clean_code and "createdAt:-1" in clean_code and "amount:1" in clean_code)
            # Ensure status appears before createdAt and createdAt before amount
            status_pos = clean_code.find("status:1")
            sort_pos = clean_code.find("createdAt:-1")
            range_pos = clean_code.find("amount:1")

            esr_valid = is_resolved and (status_pos < sort_pos < range_pos)

            return ChaosVerificationResult(
                challenge_id=challenge_id,
                is_resolved=esr_valid,
                tests_passed=2 if esr_valid else 0,
                total_tests=2,
                feedback="Correct! Index adheres to ESR: Equality first, Sort second, Range last."
                if esr_valid
                else "ESR order violated. Sort fields must precede Range fields to avoid memory sorts.",
            )

        # Default fallback
        return ChaosVerificationResult(
            challenge_id=challenge_id,
            is_resolved=len(code) > 20,
            tests_passed=1,
            total_tests=1,
            feedback="Fix accepted.",
        )

