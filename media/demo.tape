# Argus on Injective — demo recording
# Rendered with https://github.com/charmbracelet/vhs:  vhs media/demo.tape

Output media/argus-injective-demo.mp4
Output media/argus-injective-demo.gif

Set Shell zsh
Set FontSize 15
Set Width 1500
Set Height 1000
Set Padding 18
Set Theme "Catppuccin Mocha"
Set TypingSpeed 25ms

Hide
# `#` is not a comment in an interactive zsh unless this is set, and node's
# localstorage warning would otherwise land in the middle of the output.
Type "setopt interactive_comments; export NODE_OPTIONS=--no-warnings" Enter
Type "cd ~/Desktop/projects/argus-injective && clear" Enter
Sleep 1s
Show

Type "# Argus: an on-chain mandate for AI agents trading on Injective."
Enter
Sleep 2s
Type "# The agent proposes. The chain decides."
Enter
Sleep 2500ms

Type "clear" Enter
Sleep 500ms

# ---------------------------------------------------------------- tests
Type "forge test"
Enter
Sleep 14s

Type "clear" Enter
Sleep 500ms
Type "# Eight of those read live prices straight from an Injective node."
Enter
Sleep 2500ms
Type "forge test --match-path 'test/live/*' -vv | tail -30"
Enter
Sleep 15s

Type "clear" Enter
Sleep 500ms

# ---------------------------------------------------------------- live demo
Type "# Now against the deployed contract, on Injective EVM testnet."
Enter
Sleep 2500ms
Type "cd agent && npm run demo"
Enter
Sleep 32s
Sleep 8s

Type "clear" Enter
Sleep 500ms

# ---------------------------------------------------------------- on-chain refusal
Type "# A refusal that only shows up in eth_call is easy to wave away."
Enter
Sleep 2500ms
Type "# So here is one mined on-chain, signed by the agent key itself."
Enter
Sleep 2500ms
Type "npm run prove"
Enter
Sleep 25s
Sleep 8s
