# Snake

Snake is an optional game plugin for the Maze canvas host. It has no runtime dependencies.

## Build with Maze

From the Maze repository root:

```sh
npm run build:snake
npm run serve
```

Open the release page, click or tap **QLike.com** in the footer, and enter `snake`. Enter `maze` in the same palette to return to a fresh maze. A normal `npm run build` does not include Snake.
Use **Back to Home** in Snake's footer to return to a fresh Maze game.

The unminified `src/index.html` page already includes Snake and can also be opened directly as a file.
Switching to Snake sets `#snake` in the URL. Refreshing opens a fresh Snake game.

## Play

Choose a board size from **XS** through **XL**; the default is **M**, and Snake remembers its choice separately from Maze. Choose **Walls** to end the game at an edge, or **Wrap around** to emerge on the opposite edge. Snake remembers the edge setting, too. Both settings can be changed before starting or after a game ends, but are locked while playing or paused. Use Start and Pause/Resume, and steer with arrow keys or a mouse/touch swipe. Reset is available while paused or after the game ends; it returns to Ready and keeps your settings. Eating food grows the snake and adds one point; hitting its body ends the game. Game over is shown on the board. Filling the board wins.

Press **Space** to start, pause, or resume.
Food appears when the game starts and is hidden again after Reset.
In Walls mode, a dark border marks the edge of the board.

Choose **SLOW**, **NORMAL**, or **FAST** speed at any time, including during play. Snake remembers the selected speed separately.

Opening the command palette pauses Snake; choose Resume after closing the palette to continue.

## Test

Run `npm test` from `src/snake-plugin/` with Node 18 or later.
