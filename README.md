# MALLU FIGHTER II: NAADAN KOMBAT

A retro 16-bit 2D pixel arcade fighting game inspired by classic *Street Fighter II*, packed with Kerala / Mallu culture, outfits, dialogues, animated backwater/festival stages, Kerala snack power-ups, and dramatic **Super Entries**.

## How to Play

- **Option 1 (Recommended):** Double-click `play.bat` (serves the game on `http://127.0.0.1:8765` and opens your browser).
- **Option 2:** Double-click `index.html` directly in Chrome or Edge (automatically uses `dist/bundle.js`).

## Controls (100% Keyboard Ready)

| Action | 1P (`WASD + JILK` MK Style) | 2P Local Versus |
|---|---|---|
| Move | `A` / `D` (also `←`/`→` in 1P modes) | `←` / `→` |
| Jump / Crouch | `W` / `S` | `↑` / `↓` |
| Light Punch / Sweep (`S + J`) | `J` | `Numpad 1` or `,` |
| Heavy Kick / Sweep (`S + K`) | `K` | `Numpad 2` or `.` |
| Signature Projectile | `L` (or `↓ → + J/K`) | `Numpad 3` or `/` |
| Signature Dash / Anti-Air Special | `W + L` or `S + L` | `↑` or `↓` + `Numpad 3` / `/` |
| Block / Guard (High & Low) | `Space` / `U` (or Hold Back) | `Numpad 0` / `;` (or Hold Back) |
| **MASS SUPER MOVE** (at 100% Meter) | `I` | `Numpad 5` or `'` |

**Keyboard Menu Shortcuts:**
- **Character & Stage Select:** `A`/`D` 1P Fighter · `J`/`L` Rival Fighter · `W`/`S` Stage · `1`–`4` Mode · `Q` CPU Difficulty · `P` Power-Ups · `C` CRT · `Enter`/`Space` Start Fight!
- **Victory & In-Match:** `1`/`2`/`3` or `[`/`]` Change Kerala Place · `Enter`/`J` Next Challenger or Rematch · `R` Rematch · `Tab` Move List · `M` Toggle Music · `Esc` Back to Fighter Select.

## Playable Kerala Fighters

1. **Maveli (Mahabali)** — Gold Kireedam, Kasavu Mundu, and Olakkuda palm umbrella.
   - **Super Entry (*Pathalam Rising*):** Erupts directly out of a glowing Pathalam portal in a shower of Onam petals.
   - **Powers:** *Pookkalam Chakra*, *Olakkuda Sky Spin*, *Pathalam Pookkalam Fury*.
2. **Mundan George** — Popped-collar white shirt, glinting aviators, handlebar meesha, and Mundu that folds up during specials!
   - **Super Entry (*Aanavandi Drop*):** Leaps off a speeding red-and-yellow KSRTC bus and snaps his mundu up.
   - **Powers:** *Hot Parotta Disc*, *Mundu Madakki Knee*, *KSRTC Savari Giri Giri*.
3. **Unniyarcha** — Kasavu Kalari attire, jasmine *Mullappoo*, and a flexible Urumi whip-sword.
   - **Super Entry (*Nilavilakku Leap*):** Flips across lit brass temple oil lamps into a Kalari stance.
   - **Powers:** *Nilavilakku Agni Wave*, *Urumi Cyclone*, *Kadathanadan Chuvadu*.
4. **Agni Theyyam** — Towering crimson-gold Mudi headgear, Mukhathezhuthu face paint, and Adayalam skirt.
   - **Super Entry (*Ember Awakening*):** Materializes from a roaring pillar of temple fire to Chenda drumbeats.
   - **Powers:** *Agni Kundam Fireball*, *Ember Blink Strike*, *Thirayattam Inferno*.
5. **Auto Kuttan** — Khaki shirt, red *Thorthu* towel, and blue checkered lungi.
   - **Super Entry (*Kochi Meter Drift*):** Skids onto the arena in a yellow-black Auto-Rickshaw (*"No Credit"*).
   - **Powers:** *Chakka Bomb*, *Auto Horn Charge*, *Kochi Turbo Auto Ram*.

## Animated Kerala Stages

- **Alappuzha Kettuvallam:** Bobbing houseboat with cheering Mallu spectators, coconut palms, and a racing *Chundan Vallam* snake boat.
- **Fort Kochi Chayakkada:** Sunset over the sea, dipping *Cheena Vala* Chinese fishing nets, boiling Samovar tea stall, hanging *Nendran* bananas, and parked auto.
- **Thrissur Pooram Night:** Pooram fireworks, caparisoned temple elephants with *Nettipattam* and *Kudamattam* umbrellas, flickering *Nilavilakku* lamps, and Chenda drummers.

## Development & Tests

```powershell
cd kerala_fighter
npm run build   # Rebuilds dist/bundle.js from src/
npm test        # Runs Node unit tests (tests/engine.test.js)
```
