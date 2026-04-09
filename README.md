# VIdhi
**Collect non-linearly, present linearly.**

VIdhi is not a generic "AI for legal help" tool. It is a **survivor-safe intake system plus a courtroom-defense engine**. 

The survivor can speak in fragments, in any order, by voice or text, across multiple sessions. Every fragment is stored with provenance, acoustic metadata, consent state, and timestamp. Then our Bayesian resolver turns those fragments into a sensory-first ranked timeline, preserving uncertainty instead of forcing false precision. 

On the legal side, the paralegal sees the transcript with distress overlay, the ranked timeline, weak nodes flagged for review, and a cross-exam prep mode that shows where opposing counsel is most likely to attack. The export is not just a summary PDF; it is a **Daubert-ready methodology packet** with hashes, confidence scores, and reasoning traces.

---

##  Core Feature Set

1. **Survivor Intake**
   Calm UI, voice/text input, multilingual support, pause/resume, fragment-based capture, and no forced forms.

2. **Acoustic Metadata Layer**
   Captures WPM, pauses, repetitions, speech breaks, and hesitation markers. These are used as fragment metadata, *not* lie labels.

3. **Consent Panel**
   Empowers the survivor to review fragments, revoke fragments, and control access.

4. **Evidence Pipeline**
   Ensures chain of custody via fragment ID, SHA-256 hash for tamper evidence, encrypted storage, audit logging, and session history.

5. **Bayesian Reconstruction**
   Performs event extraction, entity extraction, and contradiction preservation. Uses sensory-anchor weighting over weak temporal anchors, providing confidence scores per node.

6. **Legal Dashboard**
   A split view with transcript/distress overlay on one side and a ranked timeline on the other.

7. **Cross-Exam Prep Mode**
   Highlights lowest-confidence nodes, provides contradiction explanations, and allows lawyer annotations to be pinned to specific nodes.

8. **Daubert Export**
   Generates a fully admissible packet including timeline, methodology summary, reasoning trace, confidence bands, hashes, and an annotation layer.

###  High-Value Extras 
- Trauma-informed question bank
- Cross-reference engine for repeated entities
- Expert witness brief generation

---

##  Tech Stack 

- **Frontend:** Next.js or React + Vite, Tailwind CSS or clean custom CSS (shadcn/ui only if it speeds development up).
- **Backend:** FastAPI in Python.
- **Database:** PostgreSQL (with `pgvector` for semantic retrieval, or plain Postgres for the MVP).
- **Storage:** Encrypted blob/file storage for transcript and video artifacts.
