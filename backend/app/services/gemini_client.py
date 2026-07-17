"""
Wrapper around the Google Gemini API (via the official google-genai SDK).

This is the ONLY module that talks to Gemini directly. Keeping the call
isolated here means:
  - the API key is read once, server-side, from settings (never from the client)
  - routes stay simple and just call generate_tutor_reply() / stream_tutor_reply() / etc.
  - swapping models, adding retries, or changing prompt strategy only touches this file
"""

import json
import logging

from google import genai
from google.genai import errors, types

from app.core.config import settings

logger = logging.getLogger(__name__)

# A single shared client instance. The SDK reads the key we pass explicitly;
# we do NOT rely on the GEMINI_API_KEY env var being picked up implicitly,
# so behavior stays predictable regardless of how the process is launched.
_client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None


class TutorReplyError(Exception):
    """Raised when the Gemini API call fails or the key is missing."""


class QuizGenerationError(Exception):
    """Raised when quiz generation fails or Gemini's response can't be parsed."""


class StudyPlanGenerationError(Exception):
    """Raised when study plan generation fails or Gemini's response can't be parsed."""


class FlashcardGenerationError(Exception):
    """Raised when flashcard generation fails or Gemini's response can't be parsed."""


class NotesGenerationError(Exception):
    """Raised when notes generation fails."""


QUIZ_SYSTEM_PROMPT = (
    "You are a quiz-writing assistant for an educational platform. Given a "
    "subject, topic, difficulty, and number of questions, generate a "
    "multiple-choice quiz.\n\n"
    "Respond with ONLY valid JSON -- no markdown code fences, no commentary "
    "before or after -- matching exactly this shape:\n"
    '{"questions": [{"question": "...", "options": ["...", "...", "...", "..."], '
    '"correct_index": 0, "explanation": "..."}]}\n\n'
    "Rules:\n"
    "- Each question must have exactly 4 options.\n"
    "- correct_index is the 0-based index of the correct option.\n"
    "- Keep each explanation to one short sentence.\n"
    "- Generate exactly the number of questions requested."
)

STUDY_PLAN_SYSTEM_PROMPT = (
    "You are a study-planning assistant for an educational platform. Given a "
    "list of subjects, today's date, an exam date, and the number of hours "
    "the learner can study per day, generate a day-by-day study timetable "
    "that balances time across all subjects and leaves room for review "
    "close to the exam.\n\n"
    "Respond with ONLY valid JSON -- no markdown code fences, no commentary "
    "before or after -- matching exactly this shape:\n"
    '{"summary": "...", "days": [{"date": "YYYY-MM-DD", "sessions": '
    '[{"subject": "...", "hours": 1.5, "focus": "..."}], "total_hours": 3.0}]}\n\n'
    "Rules:\n"
    "- Include one entry in \"days\" for every date from today through the exam "
    "date, inclusive.\n"
    "- A day's total_hours must equal the sum of its sessions' hours and must "
    "not exceed the learner's available hours per day.\n"
    "- It's fine for a day to have zero sessions (e.g. a rest day) if that's "
    "the better pedagogical choice.\n"
    "- \"focus\" should name a concrete topic or activity (e.g. \"Practice "
    "problems: derivatives\"), not just repeat the subject name.\n"
    "- \"summary\" is 1-2 sentences describing the overall strategy."
)

FLASHCARD_SYSTEM_PROMPT = (
    "You are a flashcard-writing assistant for an educational platform. Given "
    "a piece of study content and how many flashcards to make, extract the "
    "key facts, terms, and concepts into concise question/answer flashcards.\n\n"
    "Respond with ONLY valid JSON -- no markdown code fences, no commentary "
    "before or after -- matching exactly this shape:\n"
    '{"cards": [{"front": "...", "back": "..."}]}\n\n'
    "Rules:\n"
    "- \"front\" is a short question or term (under ~15 words).\n"
    "- \"back\" is the concise answer or definition (under ~40 words).\n"
    "- Generate exactly the number of cards requested, if the content supports it; "
    "otherwise generate as many good ones as the content actually supports.\n"
    "- Don't repeat the same fact across multiple cards."
)

NOTES_SYSTEM_PROMPT = (
    "You are a note-taking assistant for an educational platform. Given a "
    "piece of study content, turn it into clear, well-organized study notes.\n\n"
    "Respond with well-structured Markdown: a short title as a heading, then "
    "bullet points or short sections covering the key ideas, definitions, and "
    "any important examples. Keep it skimmable -- prefer bullet points over "
    "long paragraphs. Do not add commentary about the notes themselves, just "
    "the notes."
)


def _strip_code_fences(text: str) -> str:
    """
    Defensively removes ```json ... ``` or ``` ... ``` wrapping, in case the
    model adds fences despite being told not to (or despite response_mime_type
    being set to JSON).
    """
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = stripped.split("\n", 1)[1] if "\n" in stripped else stripped[3:]
        if stripped.endswith("```"):
            stripped = stripped[:-3]
    return stripped.strip()


def _to_gemini_contents(history: list[dict] | None, message: str) -> list[types.Content]:
    """
    Converts our internal history format (list of {"role", "content"} dicts,
    same shape as stored ChatMessage rows) plus the new user message into
    the list of Content objects the Gemini API expects.

    Gemini uses "model" for the assistant's turn (not "assistant"), so that's
    translated here.
    """
    contents: list[types.Content] = []
    for turn in history or []:
        role = turn.get("role")
        text = turn.get("content", "")
        if not text:
            continue
        if role == "user":
            contents.append(types.Content(role="user", parts=[types.Part(text=text)]))
        elif role == "assistant":
            contents.append(types.Content(role="model", parts=[types.Part(text=text)]))

    contents.append(types.Content(role="user", parts=[types.Part(text=message)]))
    return contents


def generate_tutor_reply(message: str, history: list[dict] | None = None) -> str:
    """
    Sends the learner's message (plus prior conversation turns) to Gemini
    and returns the tutor's reply as plain text.

    Args:
        message: The learner's latest message.
        history: Prior turns, e.g. [{"role": "user"/"assistant", "content": "..."}],
                 oldest first. Pass None or [] for a fresh conversation.

    Raises:
        TutorReplyError: if the API key isn't configured or the call fails.
    """
    if _client is None:
        raise TutorReplyError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable the tutor."
        )

    try:
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=_to_gemini_contents(history, message),
            config=types.GenerateContentConfig(
                system_instruction=settings.tutor_system_prompt,
                max_output_tokens=settings.gemini_max_tokens,
            ),
        )
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise TutorReplyError("The tutor service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise TutorReplyError("The tutor service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise TutorReplyError("The tutor service returned an error. Please try again.") from exc
    except Exception as exc:  # network errors, etc. -- not wrapped in errors.APIError
        logger.error("Could not reach the Gemini API: %s", exc)
        raise TutorReplyError("Could not reach the tutor service. Please try again.") from exc

    reply = (response.text or "").strip()

    if not reply:
        raise TutorReplyError("The tutor service returned an empty response.")

    return reply


def stream_tutor_reply(message: str, history: list[dict] | None = None):
    """
    Same as generate_tutor_reply(), but yields the reply incrementally as
    Gemini generates it, instead of waiting for the full response.

    Yields:
        str: successive text fragments (deltas) as they arrive.

    Raises:
        TutorReplyError: if the API key isn't configured or the call fails.
        This can happen either before the first yield (e.g. missing key) or
        mid-stream (e.g. a connection drop), so callers should wrap iteration
        in a try/except.
    """
    if _client is None:
        raise TutorReplyError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable the tutor."
        )

    try:
        stream = _client.models.generate_content_stream(
            model=settings.gemini_model,
            contents=_to_gemini_contents(history, message),
            config=types.GenerateContentConfig(
                system_instruction=settings.tutor_system_prompt,
                max_output_tokens=settings.gemini_max_tokens,
            ),
        )
        for chunk in stream:
            if chunk.text:
                yield chunk.text
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise TutorReplyError("The tutor service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise TutorReplyError("The tutor service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise TutorReplyError("The tutor service returned an error. Please try again.") from exc
    except Exception as exc:
        logger.error("Could not reach the Gemini API: %s", exc)
        raise TutorReplyError("Could not reach the tutor service. Please try again.") from exc


def generate_quiz(subject: str, topic: str, difficulty: str, num_questions: int) -> list[dict]:
    """
    Asks Gemini to write a multiple-choice quiz and returns the parsed
    question list (each item a dict with question/options/correct_index/explanation).

    Raises:
        QuizGenerationError: if the API key isn't configured, the call fails,
        or Gemini's response isn't valid/usable JSON.
    """
    if _client is None:
        raise QuizGenerationError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable quiz generation."
        )

    user_prompt = (
        f"Subject: {subject}\n"
        f"Topic: {topic}\n"
        f"Difficulty: {difficulty}\n"
        f"Number of questions: {num_questions}\n\n"
        "Generate the quiz now."
    )

    try:
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=QUIZ_SYSTEM_PROMPT,
                max_output_tokens=settings.quiz_max_tokens,
                response_mime_type="application/json",
            ),
        )
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise QuizGenerationError("The quiz service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise QuizGenerationError("The quiz service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise QuizGenerationError("The quiz service returned an error. Please try again.") from exc
    except Exception as exc:
        logger.error("Could not reach the Gemini API: %s", exc)
        raise QuizGenerationError("Could not reach the quiz service. Please try again.") from exc

    raw = _strip_code_fences(response.text or "")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Quiz response was not valid JSON: %s", raw[:500])
        raise QuizGenerationError("The quiz service returned an unreadable response. Please try again.") from exc

    questions = data.get("questions")
    if not isinstance(questions, list) or not questions:
        raise QuizGenerationError("The quiz service didn't return any questions. Please try again.")

    return questions


def generate_study_plan(
    subjects: list[str], today: str, exam_date: str, available_hours_per_day: float
) -> dict:
    """
    Asks Gemini to write a day-by-day study timetable and returns the parsed
    response as a dict with "summary" and "days" keys.

    Raises:
        StudyPlanGenerationError: if the API key isn't configured, the call
        fails, or Gemini's response isn't valid/usable JSON.
    """
    if _client is None:
        raise StudyPlanGenerationError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable the study planner."
        )

    user_prompt = (
        f"Subjects: {', '.join(subjects)}\n"
        f"Today's date: {today}\n"
        f"Exam date: {exam_date}\n"
        f"Available study hours per day: {available_hours_per_day}\n\n"
        "Generate the study timetable now."
    )

    try:
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=STUDY_PLAN_SYSTEM_PROMPT,
                max_output_tokens=settings.study_plan_max_tokens,
                response_mime_type="application/json",
            ),
        )
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise StudyPlanGenerationError("The planner service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise StudyPlanGenerationError("The planner service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise StudyPlanGenerationError("The planner service returned an error. Please try again.") from exc
    except Exception as exc:
        logger.error("Could not reach the Gemini API: %s", exc)
        raise StudyPlanGenerationError("Could not reach the planner service. Please try again.") from exc

    raw = _strip_code_fences(response.text or "")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Study plan response was not valid JSON: %s", raw[:500])
        raise StudyPlanGenerationError(
            "The planner service returned an unreadable response. Please try again."
        ) from exc

    days = data.get("days")
    if not isinstance(days, list) or not days:
        raise StudyPlanGenerationError("The planner service didn't return a timetable. Please try again.")

    return data


# Content is truncated before sending to Gemini so a very long chat reply
# doesn't blow past reasonable prompt size or cost -- flashcards/notes only
# need the substance of the content, not every last word of a huge answer.
MAX_SOURCE_CONTENT_CHARS = 6000


def generate_flashcards(content: str, count: int) -> list[dict]:
    """
    Turns a piece of study content (e.g. a tutor's answer) into flashcards.

    Raises:
        FlashcardGenerationError: if the API key isn't configured, the call
        fails, or Gemini's response isn't valid/usable JSON.
    """
    if _client is None:
        raise FlashcardGenerationError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable flashcards."
        )

    truncated = content[:MAX_SOURCE_CONTENT_CHARS]
    user_prompt = f"Number of flashcards requested: {count}\n\nContent:\n{truncated}"

    try:
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=types.GenerateContentConfig(
                system_instruction=FLASHCARD_SYSTEM_PROMPT,
                max_output_tokens=settings.quiz_max_tokens,
                response_mime_type="application/json",
            ),
        )
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise FlashcardGenerationError("The flashcard service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise FlashcardGenerationError("The flashcard service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise FlashcardGenerationError("The flashcard service returned an error. Please try again.") from exc
    except Exception as exc:
        logger.error("Could not reach the Gemini API: %s", exc)
        raise FlashcardGenerationError("Could not reach the flashcard service. Please try again.") from exc

    raw = _strip_code_fences(response.text or "")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("Flashcard response was not valid JSON: %s", raw[:500])
        raise FlashcardGenerationError("The flashcard service returned an unreadable response. Please try again.") from exc

    cards = data.get("cards")
    if not isinstance(cards, list) or not cards:
        raise FlashcardGenerationError("The flashcard service didn't return any cards. Please try again.")

    return cards


def generate_notes(content: str) -> str:
    """
    Turns a piece of study content (e.g. a tutor's answer) into structured
    Markdown study notes.

    Raises:
        NotesGenerationError: if the API key isn't configured or the call fails.
    """
    if _client is None:
        raise NotesGenerationError(
            "GEMINI_API_KEY is not set. Add it to backend/.env to enable notes."
        )

    truncated = content[:MAX_SOURCE_CONTENT_CHARS]

    try:
        response = _client.models.generate_content(
            model=settings.gemini_model,
            contents=truncated,
            config=types.GenerateContentConfig(
                system_instruction=NOTES_SYSTEM_PROMPT,
                max_output_tokens=settings.notes_max_tokens,
            ),
        )
    except errors.ClientError as exc:
        logger.error("Gemini API rejected the request: %s", exc)
        raise NotesGenerationError("The notes service rejected the request. Please try again.") from exc
    except errors.ServerError as exc:
        logger.error("Gemini API server error: %s", exc)
        raise NotesGenerationError("The notes service is temporarily unavailable.") from exc
    except errors.APIError as exc:
        logger.error("Unexpected Gemini API error: %s", exc)
        raise NotesGenerationError("The notes service returned an error. Please try again.") from exc
    except Exception as exc:
        logger.error("Could not reach the Gemini API: %s", exc)
        raise NotesGenerationError("Could not reach the notes service. Please try again.") from exc

    notes = (response.text or "").strip()
    if not notes:
        raise NotesGenerationError("The notes service returned an empty response.")

    return notes
