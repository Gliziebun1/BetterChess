# BetterChess

Free online chess with Elo matchmaking. No dependencies: just Node 18+.

## What's in it
- **Look**: midnight-indigo and amber theme with custom SVG pieces (gold vs. violet by default). Five piece styles (Aurora, Neon, Frost, Ember, Ivory & Ebony) and several board colours under "Board style".
- **Animation**: pieces float and glow, the selected piece lifts, moves slide, captures burst into sparks with a small board shake, castling slides both pieces, and a checked king trembles. Disabled automatically for visitors with "reduce motion" turned on.
- **Drag & drop**: the dragged piece lifts, glows and follows the cursor, the legal square under it lights up, and an illegal drop glides the piece back. Click-to-move still works.
- **Sounds**: medieval-style sounds, synthesized in the browser (no audio files): footman (boots and shield tap), knight (hooves and mail), bishop (abbey bell), rook (drawbridge slam and drum), queen (lute arpeggio), king (war horn). Captures add a sword clash, castling a drum and horn call, promotion a lute flourish with a bell, check two war drums, and premoves and selecting a piece have their own small sounds. Toggle with "Sound" in the left menu (saved in the browser).
- **Left sidebar** (Chess.com-style): Play Online, Play Computer, Puzzles, Analysis, Home, Pieces, Board style.
- **Separate tabs**: Play Online and Play Computer each have their own panel and header. Online uses player titles (Beginner to Expert); the computer's named bots (Jynxzi to Divorce Dad Dave) only appear under Play Computer.
- **AI Coach** (left menu): play the computer while the coach reviews every move (best, good, inaccuracy, mistake, blunder), warns about loose pieces, shows a live evaluation, gives two-step hints and explains the position. It uses the built-in depth-3 engine, not an online AI model.
- **Pieces** (left menu): piece looks grouped into categories: Classic, Food (Pawn=Fries, Rook=Burger, Knight=Taco, Bishop=Pizza, Queen=Sushi, King=Pizza box), Animals, Space and Memes. Your choice is saved and applies to every board.
- **Time controls** for online play (dropdown in the Play Online panel): 1 min, 2|1 (bullet); 3 min, 3|2, 5 min (blitz); 10 min, 15|10 (rapid); 30 min (classical); or unlimited. You are only matched with players searching for the same time control.
- **Clocks**: the server keeps the authoritative clocks. They start once both players have made their first move; a player who runs out of time loses (rated). If nobody moves within 30 seconds of the match starting, the game is aborted with no rating change.
- **Puzzles**: 19 mate-in-1 / mate-in-2 puzzles. Any move that still forces mate is accepted. Progress is saved in the browser.
- **Analysis**: free board for both sides, move list with navigation (arrow keys too), load/copy FEN and PGN, a depth-3 engine evaluation and best-move hint. "Analyse game" sends your last game there.
- **Training** (left menu): five levels of openings and defenses (First openings, More White weapons, Defenses to 1.e4, Defenses to 1.d4, Traps & tricks), 20 lessons in all. Each lesson has a "Next move" walkthrough with an explanation for every key move, then a "Drill it" mode where you play your side from memory. Wrong moves are explained and undone, Hint shows the piece and then the move, and completed lessons are saved in the browser. Add lessons in the `LES` array (`san~note;san;...`).
- **Moving pieces**: click-click or drag and drop. Castle by moving the king two squares, onto the rook, or by clicking the king then the rook. Promotion opens a piece picker on the board.
- **Premoves**: move on the opponent's turn (vs computer and online) and the move is shown in red with a ghost of the piece on its destination. It is played automatically once it is legal. Click elsewhere or press Esc to cancel.
- **Arrows and circles**: right-click and drag for a green arrow (Shift = red, Ctrl/Alt = blue, both = yellow); left-click clears. The "Draw arrows" button lets touch screens draw with a normal drag.
- **Settings** (left menu): show/hide board coordinates and legal-move dots, board orientation (white or black at the bottom), board colours (green, blue, brown), move animations, sound effects and reduce motion. Saved in the browser (`bc-settings`) and applied on every page load.
- **Home** with quick-play time controls and a "return to game" banner.

## Run locally
    npm start            # http://localhost:3000
Open it in two browser windows, choose "Play online" in each, press "Find a match".

## Put it on the internet (needs a host that runs a Node server)
Static hosts (GitHub Pages, Netlify, Vercel static) will NOT work: matchmaking needs the server.
Easy options: Render, Railway, Fly.io (all have free/cheap tiers).

1. Put this folder in a GitHub repo.
2. On Render: New > Web Service > pick the repo. Build command: (empty). Start command: `npm start`.
3. Set environment variable `SITE_URL` to your final address, e.g. `https://yourchess.com` (no trailing slash).
   This fills in the canonical link, sitemap and structured data.
4. Optional: buy a domain and attach it in the host's dashboard.
5. Run a single instance (matchmaking state lives in memory).

## Getting found on Google
Search engines only find a site after crawling it, which takes days to weeks and is never guaranteed.
1. Add the site in Google Search Console and Bing Webmaster Tools and verify ownership.
2. Submit `https://yourdomain/sitemap.xml` (the server generates it; robots.txt points to it).
3. Use a distinctive name/domain. "BetterChess" is generic and may compete with other sites.
4. Get a few links to it (Reddit, a Show HN post, social profiles).

## Notes
- Ratings are stored in each player's browser (localStorage) and are self-reported, so they can be edited. For a trusted ladder you'd add accounts and a database.
- Moves are checked for turn order and format by the server; full legality is checked by each client. Clients also tell the server when a game ends by checkmate/stalemate so the clocks stop; a modified client could abuse this, so a trusted ladder would need server-side move validation.
- Elo is a single rating shared by all time controls.
- Puzzles and the analysis engine run entirely in the browser.
- Dropped connections have a 15-second grace period before the opponent is told you left.

## Accounts and guests

- **Sign up**: create an account using a unique username and password. Usernames are 3–16 characters (letters, numbers, `.`, `_`, `-`); passwords are 8–128 characters.
- **Sign in**: use your username and password. Sessions last 30 days in that browser.
- **Play as guest**: the server assigns a unique `Guest` + 3 or 4 digits name. Guest names cannot be registered as accounts.
- The name shown to opponents comes from the server, never from the browser.
- Passwords are salted scrypt hashes, session tokens are stored hashed, and sign-in/sign-up/guest creation are rate limited.

### Storage

By default accounts are saved in JSON files under `DATA_DIR`. For persistent hosted storage, set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`, then run `supabase.sql` in the Supabase SQL Editor. If upgrading an existing email-based Supabase setup, back up the project first and run the migration in `supabase.sql`; existing users retain their username and password hash but must sign in again.
