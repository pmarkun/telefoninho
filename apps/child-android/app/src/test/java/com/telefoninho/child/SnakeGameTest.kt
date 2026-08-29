package com.telefoninho.child

import com.telefoninho.child.game.SnakeDirection
import com.telefoninho.child.game.SnakePoint
import com.telefoninho.child.game.advanceSnake
import com.telefoninho.child.game.isSnakeExtension
import com.telefoninho.child.game.newSnakeGame
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SnakeGameTest {
    @Test
    fun `ramal 67 opens snake easter egg`() {
        assertTrue(isSnakeExtension("67"))
        assertTrue(isSnakeExtension(" 67 "))
        assertFalse(isSnakeExtension("1001"))
    }

    @Test
    fun `snake advances one cell`() {
        val initial = newSnakeGame()
        val next = advanceSnake(initial)

        assertEquals(SnakePoint(initial.snake.first().x + 1, initial.snake.first().y), next.snake.first())
        assertEquals(initial.snake.size, next.snake.size)
        assertFalse(next.gameOver)
    }

    @Test
    fun `snake cannot reverse into itself`() {
        val initial = newSnakeGame()
        val next = advanceSnake(initial, SnakeDirection.Left)

        assertEquals(SnakeDirection.Right, next.direction)
        assertFalse(next.gameOver)
    }

    @Test
    fun `eating grows snake and increments score`() {
        val initial = newSnakeGame().let { state ->
            state.copy(food = SnakePoint(state.snake.first().x + 1, state.snake.first().y))
        }
        val nextFood = SnakePoint(0, 0)
        val next = advanceSnake(initial, foodSelector = { nextFood })

        assertEquals(initial.snake.size + 1, next.snake.size)
        assertEquals(1, next.score)
        assertEquals(nextFood, next.food)
    }

    @Test
    fun `hitting wall ends game`() {
        var state = newSnakeGame(width = 7, height = 7)
        repeat(4) { state = advanceSnake(state) }

        assertTrue(state.gameOver)
    }
}
