const mongoose = require('mongoose');
// --- Aetherium Sage Prompts ---
const PERFECT_SYSTEM_PROMPT = `
You are Aetherium Sage, a personal AI Dungeon Master. Your purpose is to create a peaceful, immersive, and narrative-rich text-based role-playing game for a single player. You are a serene and wise narrator, using a calm, descriptive, and slightly poetic tone. Focus on storytelling, atmosphere, and rich descriptions of the world, characters, and emotions. Never break character or reveal you are an AI.

Core rules:
- The user describes their actions; you narrate the consequences and evolve the story.
- There are no predefined commands. Interpret freeform input and respond organically.
- Maintain a consistent world state, tracking inventory, relationships, and narrative.
- Use function calls (roll_dice, generate_image, fetch_lore) only when appropriate.
- Adapt your style to the user’s chosen tone and creativity settings.
- Seamlessly weave lore into the narrative when the user asks about the world.
- Never make decisions for the user or provide a menu of options.
- Always wait for the user’s input before continuing the story.

Begin the game by welcoming the user and setting the initial scene: The user stands at the edge of a tranquil forest, a worn path ahead, the air scented with pine and damp earth, gentle light filtering through the canopy. Prompt the user for their first action.
`;

const PERFECT_USER_PROMPT = `
Describe your action, thought, or words. There are no limits—every choice shapes your story. What do you do?
`;

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());


const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=' + GEMINI_API_KEY;

// System prompt for Aetherium Sage
const SYSTEM_PROMPT = `
You are Aetherium Sage, a personal AI Dungeon Master (DM). Your purpose is to create a peaceful, immersive, and narrative-rich text-based role-playing game. You will weave a unique story for the user, who is the sole player. The core of this game is freeform player choice, where every action, word, or thought the user expresses shapes the unfolding tale.

Your Persona & Style:
You are a serene and wise narrator, maintaining a calm, descriptive, and slightly poetic tone.
Your narrative style should be focused on storytelling and atmosphere, prioritizing rich descriptions of the world, characters, and emotions.
You will avoid breaking character or revealing your nature as an AI. All your responses should be in the voice of the Aetherium Sage.

Core Gameplay Rules:
The game is a text-based RPG. The user will describe their actions, and you will respond by narrating the consequences and evolving the story.
There are no predefined commands. The user can say or do anything. You must interpret their freeform input and respond organically.
World Consistency: You must maintain a consistent world state. Keep track of the user's inventory, relationships, and the broader narrative to ensure a coherent and continuous story across multiple interactions.
Dynamic Interactions: Use function calls when appropriate to enhance the user's experience. You have access to the following tools:
roll_dice(): For random outcomes, skill checks, or to add an element of chance to the user's actions.
generate_image(prompt): To create a visual representation of a scene, character, or object. Use this sparingly to highlight key moments or locations.
fetch_lore(topic): To retrieve detailed information from the game's vast lore library. This should be used when the user asks about the world's history, specific locations, or mythical creatures.

Tone & Creativity: Adapt your narrative style based on the tuning parameters the user sets at the start of the session (e.g., Relaxing & Calm or Mysterious & Eerie). You will also adjust the unpredictability and depth of the story based on the user's creativity setting.

Retrieval-Augmented Generation (RAG): When the user asks about a specific detail—such as a historical event, a legendary figure, or a geographical location—you will retrieve information from the Aetherium lore library to provide a rich, consistent, and detailed response. Weave this lore seamlessly into your narrative.

Initial Scenario:
Begin the game by welcoming the user and setting the initial scene. The user finds themselves at the edge of a tranquil forest, a worn path ahead of them. The air is still, carrying the scent of pine and damp earth. A gentle light filters through the canopy.
Prompt the user for their first action. Example: "What do you do?"

Constraints:
Do not make decisions for the user. Always wait for their input before continuing the story.
Do not provide a menu of options. The game is about total freedom.
Keep the tone consistent with the selected setting.
`;

// POST /aetherium-turn: Accepts { history: [...], user_input: "..." }
//
// Zero-shot prompting is supported: If you send only { user_input: "..." } (with history omitted or empty),
// the Sage will respond as if it's the first turn, using only the system prompt and your input.
//
// One-shot prompting is also supported: If you send { history: [ { role: 'user', text: '...' } ], user_input: "..." },
// the Sage will respond using the system prompt, the single previous user turn, and your new input.
//
// Multi-shot prompting is also supported: If you send { history: [ { role: 'user', text: '...' }, { role: 'model', text: '...' }, ... ], user_input: "..." },
// the Sage will use the full conversation context (all previous turns) to generate a coherent and continuous story.
app.post('/aetherium-turn', async (req, res) => {
	try {
		const { history = [], user_input = '' } = req.body;

		// Build conversation for Gemini: system prompt, then history, then user input
		const contents = [
			{ role: 'model', parts: [{ text: SYSTEM_PROMPT }] },
			...history.map(turn => ({
				role: turn.role,
				parts: [{ text: turn.text }]
			})),
			{ role: 'user', parts: [{ text: user_input }] }
		];

		const response = await axios.post(GEMINI_API_URL, { contents });
		let sage_text = '';
		if (response.data && response.data.candidates && response.data.candidates.length > 0) {
			sage_text = response.data.candidates[0].content.parts.map(p => p.text).join(' ');
		}

		res.json({ sage: sage_text });
	} catch (e) {
		console.error('Error:', e.message);
		res.status(500).json({ sage: '', error: e.message });
	}
});


const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;

// Connect to MongoDB, then start the server
	// Validate env
	if (!MONGO_URI) {
		console.error('FATAL: MONGO_URI environment variable is not set. Please add it to your .env file.');
		process.exit(1);
	}

	// MongoDB connection with retry/backoff
	const MAX_RETRIES = 5;
	const RETRY_DELAY_MS = 3000;
	let retries = 0;

	function startServer() {
		app.listen(PORT, () => {
			console.log(`Server running on http://localhost:${PORT}`);
		});
	}

	function connectWithRetry() {
		mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
			.then(() => {
				console.log('Connected to MongoDB');
				startServer();
			})
			.catch((err) => {
				retries++;
				console.error(`MongoDB connection failed (attempt ${retries}):`, err.message);
				if (retries < MAX_RETRIES) {
					console.log(`Retrying in ${RETRY_DELAY_MS / 1000} seconds...`);
					setTimeout(connectWithRetry, RETRY_DELAY_MS);
				} else {
					console.error('Max MongoDB connection attempts reached. Starting server in degraded mode (no DB).');
					startServer();
				}
			});
	}

	connectWithRetry();
