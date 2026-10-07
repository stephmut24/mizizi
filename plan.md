# Mizizi: plan, schedule and prompts

Deadline: **Monday 12 October, 08:59 (Lubumbashi)** = Sunday 11 Oct, 23:59 PDT.
Rule: NEW repository, started now. Do not copy KukuTrack code. Commit often, from the first day.
Challenge: Hacktoberfest Week 1, theme "Touch Grass". Tags: devchallenge, hf26challenge.

## The idea in one sentence
Walk with an elder, write down what they say about each plant, and let a local AI turn the
notes into a printable family herbarium, with proof for every line and questions that send
you back outside.

## Why it fits "Touch Grass"
The app is used before and after a walk, never during. It produces a printed walk sheet and
"questions for the next walk". Real walks with a real person are the heart of the story.

## The AI is in the middle, and it is accountable
- Gemma (local, Ollama) organizes raw notes into a card.
- Every item must carry a verbatim quote from the notes, checked by code. No quote, no item.
- The user reviews and confirms. No identification, no advice, no invented facts.

## Prompts (paste one at a time, plan mode first)
| # | File | What it builds |
|---|------|----------------|
| 01 | PROMPT_01_skeleton.md | NestJS backend, SQLite, elders, walks, plants API, tests |
| 02 | PROMPT_02_notebook_ui.md | React UI: add a person, walk and plant, browse cards |
| 03 | PROMPT_03_organizer.md | Ollama client + notes-to-card organizer with the evidence guard |
| 04 | PROMPT_04_review_flow.md | "Organize with AI" screen: review, edit, confirm |
| 05 | PROMPT_05_print_nextwalk.md | printable cards and booklet, next-walk questions |
| 06 | PROMPT_06_docs_demo.md | demo data (fake), README, polish |

## Schedule (Lubumbashi time)
- **Wed 7 Oct, afternoon-evening:** new GitHub repo, AGENTS.md, install, prompt 01 and 02.
- **Thu 8 Oct:** prompt 03 and 04. Test the model with real sentences using `npm run try:organize -- notes.txt`.
- **Fri 9 Oct:** prompt 05. **Ask the elder now** and plan the real walk for Fri or Sat.
- **Sat 10 Oct:** the real walk, in the morning. Take notes (and plant photos only, no faces).
  Enter them in the app. Fix problems you saw. Prompt 06, screenshots, demo video.
- **Sun 11 Oct:** write the article in the morning, publish by the evening at the latest.
- **Mon 12 Oct, until 08:59:** safety margin only.

## If you fall behind, cut in this order
1. Photos on cards  2. Booklet (keep single card printing)  3. Next-walk questions
Never cut: prompts 01 to 04 and the real walk. They are the project.

## Categories worth entering (only if true at publication)
- **Best Use of Gemma**: local Gemma organizes notes with a verifiable evidence guard.
- **Best Use of ElevenLabs** (optional): generate the narration of your demo video.
- **Best Use of Entire** (optional): share the agent sessions behind the project in the article.

## Before the real walk (do not skip)
- Ask the elder clearly, in your own words, and note their agreement. They choose which
  plants are `private` or `shareable`. Show them what the app writes about them.
- Only photograph plants, not people. Do not publish names, places or photos of the elder
  without their explicit agreement.
- Keep the article honest: say it was one walk, with one elder, with a short test.