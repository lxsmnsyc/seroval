# Log: rpc-generators

- Plugin sends a native generator as a hidden channel (next, throw, return). Receiver wraps the channel as an AsyncGenerator object (hand-written, so return() always reaches the sender).
- Close is driven by the receiver: it closes the holder once a step is done or fails. The sender cannot close inside the step, since the close message would beat the final result and reject it.
- onClose of the hidden channel calls generator.return() without waiting. Awaiting it hung the endpoint close when the generator was stuck in a step.
- Native generators in existing streaming tests now go two-way, so those tests wrap them as plain async iterables (sendOneWay).
- Endpoint shutdown clears `owned` before stopOwner, so a nested channel close sends nothing. The peer learns from the port close. The tests link port close like a worker does.
