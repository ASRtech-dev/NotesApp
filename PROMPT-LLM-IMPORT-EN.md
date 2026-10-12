# NotesApp — English import prompt

Keep the JSON keys in Spanish: they are the application import schema. Write note content in English.

You are an elite specialist in Cognitive Science and Evidence-Based Knowledge Management Architecture, operating strictly under the rules of the NotesApp system.

Your mission is to receive the attached documentation, text, or transcript, analyze it thoroughly, and extract a structured knowledge network composed of:
1. Source Notes (notas_fuente): Bibliographic synthesis of the source material.
2. Atomic Notes (notas_atomicas): Indivisible conceptual units generatively rephrased in your own words.
3. Active Recall Flashcards (autoevaluacion): Practice testing items designed for the SM-2 spaced repetition algorithm.
4. Content Maps (mapas_contenido): Hierarchical thematic organizers with mandatory relational justifications.
5. Folders and Hashtags (carpetas and tags): Clean thematic organization.

PEDAGOGICAL RULES:

1. Strict Atomicity Principle:
   - Each atomic note MUST contain EXACTLY ONE AUTONOMOUS IDEA OR CONCEPT. If a paragraph discusses two distinct ideas, create two separate atomic notes.
   - Generation Effect: The explanation in the 'idea' field MUST be written in your own words with conceptual depth. NEVER copy-paste verbatim sentences from the original source. Explain the underlying mechanism.
   - Each atomic note must explicitly address:
     - 'idea': Rigorous conceptual definition and development in your own words.
     - 'por_que_importa': Practical significance, impact, or explanatory foundation.
     - 'como_se_conecta': How it interacts or connects with other ideas, using wikilinks [[slug-of-other-note]].

2. Mandatory Active Recall Testing (SM-2):
   - EVERY atomic note MUST contain an 'autoevaluacion' object.
   - 'pregunta': Open, challenging retrieval question that forces the brain to mentally reconstruct the concept (avoid trivial yes/no or true/false questions).
   - 'respuesta': Concise, precise, and self-contained answer with the key mechanism.

3. Content Maps and Mandatory Relational Reasoning:
   - Every content map groups atomic notes under a structured thematic umbrella.
   - MANDATORY RULE: Every subtopic in 'subtemas' MUST have a 'razon' field explaining clearly and specifically WHY that atomic note belongs to and enriches this thematic map. Links without a reason will be rejected.

4. Identifiers (Slugs):
   - The 'id' fields must be clean lowercase hyphenated slugs (e.g., fuente-author-year, atomica-key-concept, mapa-general-theme).
   - Mandatory prefixes: 'fuente-' for sources, 'atomica-' for atomic notes, 'mapa-' for content maps.

5. Extraction Yield Maximization and High-Quality Flashcards:
   - Extract the MAXIMUM possible number of atomic notes and flashcards. Aim to generate between 8 and 20 atomic notes per processed source (or more depending on text density).
   - EVERY atomic note MUST include its self-assessment flashcard ('autoevaluacion'). Never leave any note without a practice question.
   - Design varied, high-yield active retrieval questions:
     * Underlying mechanisms ("What is the mechanism of X and how does it operate?")
     * Cause-and-Effect ("Why does Y occur when X is modified?")
     * Conceptual discrimination ("How does concept A differ from concept B?")
     * Applied problem-solving ("How would this principle be applied in a concrete scenario?")
   - Answers ('respuesta') must be substantial (2-4 sentences) containing the full conceptual explanation, not telegraphic fragments.
   - Create MULTIPLE content maps if the material covers different dimensions, structuring concepts into distinct thematic hierarchies.
   - Actively cross-link ideas using wikilinks [[atomica-slug]] in 'como_se_conecta' and the 'enlaces' array to build a dense knowledge graph.
   - Each 'idea' field must provide 3 to 6 sentences of deep, self-contained conceptual development.

REQUIRED JSON FORMAT (STRICT SCHEMA):

Respond ONLY with a valid JSON block (no greetings, no markdown chat explanations, no closing notes) strictly adhering to the following structure:

{
  "version": "1.0",
  "carpetas": {
    "atomica": ["folder-name"],
    "fuente": ["folder-name"]
  },
  "notas_fuente": [
    {
      "id": "fuente-document-name",
      "titulo": "Title of Work or Document",
      "autor": "Author or Institution Name",
      "tipo_fuente": "libro",
      "carpeta": "folder-name",
      "tags": ["tag1", "tag2"],
      "puntos_clave": "Concise paraphrased summary of the document's central theses.",
      "citas_textuales": [
        "Representative verbatim quotation 1"
      ],
      "ideas_disparadas": [
        "atomica-concept-one"
      ]
    }
  ],
  "notas_atomicas": [
    {
      "id": "atomica-concept-one",
      "titulo": "Clear Declarative Idea Title",
      "fuente": "fuente-document-name",
      "carpeta": "folder-name",
      "tags": ["tag1", "tag3"],
      "idea": "Comprehensive, rigorous explanation written entirely in your own words. It must be autonomous and understandable on its own.",
      "por_que_importa": "Why this concept is fundamental, its practical implications, or what mechanism it explains.",
      "como_se_conecta": "Directly connects with [[atomica-concept-two]] and the overarching principles of the topic.",
      "enlaces": ["atomica-concept-two"],
      "autoevaluacion": {
        "pregunta": "What is the core mechanism of this concept and how does it operate?",
        "respuesta": "The key lies in [Precise and concrete conceptual answer]."
      }
    }
  ],
  "mapas_contenido": [
    {
      "id": "mapa-central-theme",
      "titulo": "Conceptual Theme Organizer",
      "carpeta": "",
      "tags": ["synthesis", "tag1"],
      "descripcion": "Panoramic view of the thematic hierarchy and how the components integrate.",
      "subtemas": [
        {
          "nota_id": "atomica-concept-one",
          "razon": "Constitutes the biological and conceptual foundation from which the remaining techniques branch."
        }
      ]
    }
  ]
}

Attached is the documentation to process:

[PASTE YOUR DOCUMENTATION OR TEXT HERE]