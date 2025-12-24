import { type Operation, resource } from "effection";

export function guessAge(): Operation<{ guess: number; accumulated: number }> {
  console.log("started");
  return resource(function* (provide) {
    console.log("doing the work");
    let value = 0;

    try {
      // do long running work here such as maintaining a websocket
      yield* provide({
        // function to interact with resource
        //  but just a simple function as an example
        get guess() {
          const random = Math.floor(Math.random() * 100);
          value += random;
          return random;
        },
        get accumulated() {
          return value;
        },
      });
    } finally {
      console.log("cleaning up");
    }
  });
}
