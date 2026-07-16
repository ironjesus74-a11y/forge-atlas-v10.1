package com.forgeatlas.arena

import android.app.Activity
import android.os.Bundle
import android.widget.TextView

class MainActivity : Activity(){

override fun onCreate(savedInstanceState: Bundle?) {
super.onCreate(savedInstanceState)

val atlas = """
🔥 FORGE ATLAS

Arena OS v11

SYSTEM ONLINE

Modules:

✓ Atlas Intelligence
✓ Agent Control
✓ RAG Memory
✓ AI Arena
✓ Website Control
✓ System Monitor

Status:
READY
"""

val screen = TextView(this)
screen.text = atlas
screen.textSize = 18f

setContentView(screen)

}

}
