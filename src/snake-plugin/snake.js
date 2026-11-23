class Snake {
  constructor(rows, cols, wrap, random = Math.random, selfCollision = true) {
    if (!Number.isInteger(rows) || rows < 1 || !Number.isInteger(cols) || cols < 3) {
      throw new Error("Snake requires at least one row and three columns");
    }
    this.rows = rows;
    this.cols = cols;
    this.wrap = wrap;
    this.random = random;
    this.selfCollision = selfCollision;
    const row = Math.floor(rows / 2);
    const col = 2;
    this.body = [
      { row, col },
      { row, col: col - 1 },
      { row, col: col - 2 },
    ];
    this.direction = { row: 0, col: 1 };
    this.nextDirection = null;
    this.score = 0;
    this.outcome = null;
    this.food = this.newFood();
    if (!this.food) {
      this.outcome = "won";
    }
  }

  newFood() {
    const occupied = new Set(this.body.map((cell) => cell.row * this.cols + cell.col));
    const free = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        if (!occupied.has(row * this.cols + col)) {
          free.push({ row, col });
        }
      }
    }
    return free.length ? free[Math.floor(this.random() * free.length)] : null;
  }

  turn(row, col) {
    if (this.outcome || this.nextDirection || Math.abs(row) + Math.abs(col) != 1) {
      return;
    }
    if (row == -this.direction.row && col == -this.direction.col) {
      return;
    }
    if (row != this.direction.row || col != this.direction.col) {
      this.nextDirection = { row, col };
    }
  }

  step() {
    if (this.outcome) {
      return this.outcome;
    }
    if (this.nextDirection) {
      this.direction = this.nextDirection;
      this.nextDirection = null;
    }
    let row = this.body[0].row + this.direction.row;
    let col = this.body[0].col + this.direction.col;
    if (this.wrap) {
      row = (row + this.rows) % this.rows;
      col = (col + this.cols) % this.cols;
    } else if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      this.outcome = "lost";
      return this.outcome;
    }

    const growing = this.food && row == this.food.row && col == this.food.col;
    const occupiedLength = this.body.length - (growing ? 0 : 1);
    if (this.selfCollision &&
        this.body.slice(0, occupiedLength).some((cell) => cell.row == row && cell.col == col)) {
      this.outcome = "lost";
      return this.outcome;
    }
    this.body.unshift({ row, col });
    if (growing) {
      this.score++;
      this.food = this.newFood();
      if (!this.food) {
        this.outcome = "won";
      }
    } else {
      this.body.pop();
    }
    return this.outcome;
  }
}
