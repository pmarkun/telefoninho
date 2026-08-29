package com.telefoninho.child

import com.telefoninho.child.data.ApiClient
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Test
import java.net.InetAddress
import java.net.ServerSocket
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

class ApiClientTest {
    @Test
    fun `delete message sends a valid json body`() = runTest {
        val server = ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))
        val executor = Executors.newSingleThreadExecutor()
        val request = executor.submit<String> {
            server.accept().use { socket ->
                val reader = socket.getInputStream().bufferedReader()
                val headers = buildString {
                    while (true) {
                        val line = reader.readLine() ?: break
                        if (line.isEmpty()) break
                        appendLine(line)
                    }
                }
                val contentLength = headers.lineSequence()
                    .first { it.startsWith("Content-Length:", ignoreCase = true) }
                    .substringAfter(':')
                    .trim()
                    .toInt()
                val body = CharArray(contentLength)
                reader.read(body)
                socket.getOutputStream().write("HTTP/1.1 204 No Content\r\nConnection: close\r\n\r\n".toByteArray())
                headers + "\n" + body.concatToString()
            }
        }

        try {
            ApiClient("http://127.0.0.1:${server.localPort}")
                .deleteMessage("message-1", "test-token")

            val received = request.get(5, TimeUnit.SECONDS)
            assertTrue(received.contains("Content-Type: application/json", ignoreCase = true))
            assertTrue(received.endsWith("{}"))
        } finally {
            server.close()
            executor.shutdownNow()
        }
    }
}
