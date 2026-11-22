/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */
const gameRegistrations = [];

function registerGame(command, GameClass) {
  gameRegistrations.push([command, GameClass]);
}

registerGame("maze", MazeGame);

addEventListener("load", () => {
  const host = new GameHost(document.body);
  for (const [command, GameClass] of gameRegistrations) {
    host.registerGame(command, GameClass);
  }
  let activeCommand = null;
  let invalidFragment = false;
  host.onSelectGame = (command, GameClass) => {
    host.start(GameClass);
    activeCommand = command;
    invalidFragment = false;
    if (window.location.hash != "#" + command) {
      window.location.hash = "#" + command;
    }
  };
  const navigate = () => {
    const command = window.location.hash.slice(1).toLowerCase() || "maze";
    const GameClass = host.games.get(command);
    if (!GameClass) {
      if (activeCommand == null) {
        host.start(MazeGame);
        activeCommand = "maze";
      }
      invalidFragment = true;
      host.showUnknownCommand(command);
    } else {
      if (command != activeCommand) {
        host.start(GameClass);
        activeCommand = command;
      } else if (invalidFragment) {
        host.closePalette();
      }
      invalidFragment = false;
    }
  };
  window.addEventListener("hashchange", navigate);
  navigate();
});
