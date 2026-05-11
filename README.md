# TTS Studio — AI84pro

Professional Text-to-Speech Studio powered by AI84pro API.

## Features

**Text to Speech**
- ElevenLabs & Minimax provider support
- Browse voices from API or enter Voice ID manually
- ElevenLabs stability: 0 / 0.5 / 1
- Minimax: speed, pitch, volume sliders
- Pause between lines: 0s / 1s / 2s / 3s / 5s / 6s
- MP3 or WAV output
- Audio playback + download

**Dialogue to Speech**
- Two speakers with independent voice/model/settings
- Script format: `#1 text` / `#2 text`
- Mute speaker for listening practice (language learning)
- Pause between turns control
- Live script preview

## Deploy to Vercel

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Run in this folder
vercel

# 3. Follow prompts — done!
```

Or connect your GitHub repo to Vercel for automatic deploys.

## Local Development

```bash
npm install
npm run dev
# Open http://localhost:3000
```

## Usage

1. Click ⚙ Settings → enter your AI84pro API key (or login with email/password)
2. Select **Text to Speech** or **Dialogue** tab
3. Configure voice, model, and settings
4. Generate → play or download

## Script Format (Dialogue Tab)

```
#1 Hello! How are you today?
#2 I'm doing great, thank you!
#1 That's wonderful. Shall we begin?
#2 Absolutely, let's get started!
```

Lines not starting with `#1` or `#2` are ignored.

## Mute Feature (Language Learning)

Mute Speaker 1 or 2 to create a "listening practice" version.
The muted speaker's lines are skipped — listeners practice speaking those lines themselves.
