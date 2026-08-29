package com.telefoninho.child.game

import kotlin.random.Random

const val SNAKE_EXTENSION = "67"

fun isSnakeExtension(extension: String): Boolean = extension.trim() == SNAKE_EXTENSION

data class SnakePoint(val x: Int, val y: Int)

enum class SnakeDirection(val dx: Int, val dy: Int) {
    Up(0, -1),
    Down(0, 1),
    Left(-1, 0),
    Right(1, 0),
}

data class SnakeGameState(
    val width: Int,
    val height: Int,
    val snake: List<SnakePoint>,
    val food: SnakePoint,
    val direction: SnakeDirection,
    val score: Int = 0,
    val gameOver: Boolean = false,
)

fun newSnakeGame(width: Int = 15, height: Int = 15): SnakeGameState {
    val centerX = width / 2
    val centerY = height / 2
    return SnakeGameState(
        width = width,
        height = height,
        snake = listOf(
            SnakePoint(centerX, centerY),
            SnakePoint(centerX - 1, centerY),
            SnakePoint(centerX - 2, centerY),
        ),
        food = SnakePoint((centerX + 4).coerceAtMost(width - 1), centerY),
        direction = SnakeDirection.Right,
    )
}

fun advanceSnake(
    state: SnakeGameState,
    requestedDirection: SnakeDirection = state.direction,
    foodSelector: (List<SnakePoint>) -> SnakePoint = ::randomFreeCell,
): SnakeGameState {
    if (state.gameOver) return state

    val direction = if (requestedDirection.isOpposite(state.direction)) {
        state.direction
    } else {
        requestedDirection
    }
    val head = state.snake.first()
    val nextHead = SnakePoint(head.x + direction.dx, head.y + direction.dy)
    val ateFood = nextHead == state.food
    val bodyToCheck = if (ateFood) state.snake else state.snake.dropLast(1)
    val hitWall = nextHead.x !in 0 until state.width || nextHead.y !in 0 until state.height
    val hitBody = nextHead in bodyToCheck
    if (hitWall || hitBody) return state.copy(direction = direction, gameOver = true)

    val nextSnake = listOf(nextHead) + if (ateFood) state.snake else state.snake.dropLast(1)
    val freeCells = buildList {
        for (y in 0 until state.height) {
            for (x in 0 until state.width) {
                val point = SnakePoint(x, y)
                if (point !in nextSnake) add(point)
            }
        }
    }
    if (freeCells.isEmpty()) {
        return state.copy(
            snake = nextSnake,
            direction = direction,
            score = state.score + 1,
            gameOver = true,
        )
    }

    return state.copy(
        snake = nextSnake,
        food = if (ateFood) foodSelector(freeCells) else state.food,
        direction = direction,
        score = state.score + if (ateFood) 1 else 0,
    )
}

private fun SnakeDirection.isOpposite(other: SnakeDirection): Boolean =
    dx == -other.dx && dy == -other.dy

private fun randomFreeCell(freeCells: List<SnakePoint>): SnakePoint =
    freeCells[Random.nextInt(freeCells.size)]
