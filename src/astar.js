/**
 * @author Wang, Hui (huiwang@qlike.com)
 * @repo https://github.com/hui-w/maze
 * @licence MIT
 */

/* A reusable A* search. It knows nothing about mazes, canvas, or
 * the game: a node can be anything, and the caller describes the
 * graph with functions.
 *
 * How A* works, in plain terms:
 *   Every node gets a score f = g + h.
 *     g = the actual cost of the cheapest route found so far
 *         from the start to this node.
 *     h = a guess (heuristic) of the remaining cost from this
 *         node to the goal. It must never overestimate, or the
 *         result may not be the cheapest route. With h = 0
 *         the search becomes Dijkstra's algorithm: it just
 *         expands by g.
 *   The search always expands the open node with the lowest f
 *   first, because that node looks most promising overall.
 *   Expanding a node means looking at all its neighbours and,
 *   for each one, recording a cheaper route to it if this one
 *   is cheaper than any route seen before.
 *   When the goal itself is expanded, the cheapest route to it
 *   is known, and getRoute() walks the came-from links back
 *   from the goal to the start, then reverses them.
 *
 * openArea - nodes that have been discovered (a route to them
 *   is known) but not yet expanded. They are the candidates
 *   for the next step; the one with the lowest f wins.
 * closeArea - nodes that have already been expanded. They
 *   are done: with a consistent heuristic their g score is
 *   already the cheapest possible, so they are never expanded
 *   again, and neighbours that are already closed are skipped.
 *   In the maze, these two lists are what the animation shades:
 *   open nodes in one colour, closed nodes in another.
 *
 * Using it:
 *   new AStar(start, goal, getNeighbors, options)
 *
 * Required, as positional arguments so they cannot be mistaken
 * for optional settings:
 *   start        - the node to start from
 *   goal         - the node to reach
 *   getNeighbors - function (node) => [nodes reachable from it]
 *
 * Optional, in the options object (all with defaults):
 *   getCost      - function (from, to) => number, default 1
 *   getHeuristic - function (node, goal) => number, default 0
 *                  (with 0 the search is Dijkstra's algorithm)
 *   getKey       - function (node) => key, default the node itself.
 *                  Use it when two different objects can mean the same
 *                  node, e.g. a maze cell identified by "row_3_col_5".
 *
 * Output:
 *   findPath() => [start, ..., goal], both ends included, or null
 *                 when no route exists. It never mutates the nodes:
 *                 the came-from links and scores live in this object.
 *
 * Animated search:
 *   Use step() instead of findPath(). step() returns the node
 *   just expanded, or null when the search is finished (found
 *   or exhausted). isFound() then says which one it was, and
 *   getRoute() returns the route. findPath() is just init()
 *   plus step() in a loop, so both ways share one engine.
 *   step() itself is built from the familiar helpers getF,
 *   inOpenArea, neighboursIntoOpenArea and getOpenNodeWithMinF,
 *   working on openArea / closeArea.
 *
 * Sample usage:
 *
 *   const graph = {
 *     A: ["B", "D"],
 *     B: ["C"],
 *     C: [],
 *     D: ["C"],
 *   };
 *   const astar = new AStar("A", "C", (node) => graph[node]);
 *   let route = astar.findPath();
 *   // route: ["A", "B", "C"]  (or ["A", "D", "C"] - both cost 2)
 *   // route is null when no route exists, e.g. start "C", goal "A".
 *
 * For an animated search, drive it yourself instead of findPath():
 *
 *   astar.init();
 *   let node;
 *   while ((node = astar.step()) != null) {
 *     // draw astar.openArea / astar.closeArea here
 *   }
 *   if (astar.isFound()) {
 *     route = astar.getRoute();
 *   }
 */
class AStar {
  constructor(start, goal, getNeighbors, options) {
    if (start === undefined) {
      throw new Error("AStar: start is required");
    }
    if (goal === undefined) {
      throw new Error("AStar: goal is required");
    }
    if (typeof getNeighbors !== "function") {
      throw new Error("AStar: getNeighbors must be a function");
    }
    options = options || {};

    this.startNode = start;
    this.goalNode = goal;
    this.getNeighbors = getNeighbors;
    this.getCost =
      typeof options.getCost === "function"
        ? options.getCost
        : () => 1;
    this.getHeuristic =
      typeof options.getHeuristic === "function"
        ? options.getHeuristic
        : () => 0;
    this.getKey =
      typeof options.getKey === "function"
        ? options.getKey
        : (node) => node;

    //discovered but not yet expanded (candidates for the next step)
    this.openArea = [];
    //already expanded (done, never expanded again)
    this.closeArea = [];
    this._cameFrom = new Map();
    this._gScore = new Map();
    this._fScore = new Map();
    //key -> open node, so inOpenArea can find a node by its key at once
    this._openKeys = new Map();
    this._closedKeys = new Set();
    this._started = false;
    this._finished = false;
    this._found = false;
  }

  /* reset and put the start node in the open list */
  init() {
    this.openArea = [this.startNode];
    this.closeArea = [];
    this._cameFrom = new Map();
    this._gScore = new Map();
    this._fScore = new Map();
    this._openKeys = new Map();
    this._openKeys.set(this.getKey(this.startNode), this.startNode);
    this._closedKeys = new Set();
    this._gScore.set(this.getKey(this.startNode), 0);
    this._fScore.set(
      this.getKey(this.startNode),
      this.getHeuristic(this.startNode, this.goalNode),
    );
    this._started = true;
    this._finished = this.getKey(this.startNode) === this.getKey(this.goalNode);
    this._found = this._finished;
  }

  /* One search step, in the old familiar shape: get the open node
   * with the smallest F, check if it is the goal, otherwise put
   * its neighbours into the open area. Returns that node, or
   * null when the search is finished (goal found, or open empty). */
  step() {
    if (!this._started) {
      this.init();
    }
    if (this._finished) {
      return null;
    }
    if (this.openArea.length === 0) {
      this._finished = true;
      return null;
    }

    //1. pick the most promising candidate and move it to the closed list
    const current = this.getOpenNodeWithMinF();
    const currentKey = this.getKey(current);

    //2. if it is the goal, the cheapest route to it is now known
    if (currentKey === this.getKey(this.goalNode)) {
      this._found = true;
      this._finished = true;
      return current;
    }

    //3. otherwise, expand it: put its neighbours into the open list
    this.neighboursIntoOpenArea(current);
    return current;
  }

  /* F, H and G for going from one node to a neighbour through it:
   * G is the route so far plus this step's cost, H is the
   * heuristic estimate from the neighbour to the goal, F = G + H.
   * The scores are kept in this object's maps, not on the nodes. */
  getF(prvNode, crtNode) {
    const g =
      this._gScore.get(this.getKey(prvNode)) + this.getCost(prvNode, crtNode);
    const h = this.getHeuristic(crtNode, this.goalNode);
    return {
      F: h + g,
      H: h,
      G: g,
    };
  }

  /* check if the node exists in the open area; returns that node, or null.
   * Uses the open-key map, so it finds the node at once instead of
   * scanning the whole open area. The check is explicit, not
   * truthiness, so a falsy node (for example 0) is still found. */
  inOpenArea(node) {
    const found = this._openKeys.get(this.getKey(node));
    return found !== undefined ? found : null;
  }

  /* put a node's neighbours into the open area, if they are not closed.
   * To a neighbour already in the open area, get the new G value for it;
   * if the new G is smaller, change its parent to the current node. */
  neighboursIntoOpenArea(node) {
    const neighbors = this.getNeighbors(node);
    for (let i = 0; i < neighbors.length; i++) {
      let neighbor = neighbors[i];
      let key = this.getKey(neighbor);
      //already expanded: its cheapest route is already known, skip it
      if (this._closedKeys.has(key)) {
        continue;
      }
      let fObj = this.getF(node, neighbor);
      let tmpNode = this.inOpenArea(neighbor);
      if (tmpNode !== null && this._gScore.get(key) <= fObj.G) {
        continue;
      }
      this._cameFrom.set(key, node);
      this._gScore.set(key, fObj.G);
      this._fScore.set(key, fObj.F);
      if (tmpNode === null) {
        this.openArea.push(neighbor);
        this._openKeys.set(key, neighbor);
      }
    }
  }

  /* Get the node with smallest F from the open list, and move it
   * to the closed list. Returns that node, or null when the open
   * list is empty. No sort is needed: one pass over the open list
   * finds the minimum, which is cheaper than sorting it every
   * step, and it leaves the other nodes in their original order.
   * A strict < keeps the first node on a tie, so ties are broken
   * in discovery order, as a stable sort would. */
  getOpenNodeWithMinF() {
    if (this.openArea.length == 0) {
      return null;
    }
    let minIndex = 0;
    let minF = this._fScore.get(this.getKey(this.openArea[0]));
    for (let i = 1; i < this.openArea.length; i++) {
      let f = this._fScore.get(this.getKey(this.openArea[i]));
      if (f < minF) {
        minF = f;
        minIndex = i;
      }
    }
    const node = this.openArea.splice(minIndex, 1)[0];
    const key = this.getKey(node);
    this._openKeys.delete(key);
    this._closedKeys.add(key);
    this.closeArea.push(node);
    return node;
  }

  isFound() {
    return this._found;
  }

  isFinished() {
    return this._finished;
  }

  /* The route found, from start to goal, or null when not found.
   * Only valid after the search has finished. It walks the
   * came-from links backwards from the goal to the start,
   * then reverses them, so the result reads start to goal. */
  getRoute() {
    if (!this._found) {
      return null;
    }
    const route = [];
    let node = this.goalNode;
    while (node !== undefined) {
      route.push(node);
      if (this.getKey(node) === this.getKey(this.startNode)) {
        break;
      }
      node = this._cameFrom.get(this.getKey(node));
    }
    route.reverse();
    return route;
  }

  /* Run the whole search at once: init(), then step() until
   * finished. This is the simple entry point. */
  findPath() {
    this.init();
    while (!this._finished) {
      this.step();
    }
    return this.getRoute();
  }
}
