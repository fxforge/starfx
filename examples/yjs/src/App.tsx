import {
  TypedUseSelectorHook,
  useDispatch,
  useSelector as useSel,
} from "starfx/react";
import "./App.css";
import { AppState, createFolder, schema } from "./thunks.js";

const useSelector: TypedUseSelectorHook<AppState> = useSel;

function App({ id }: { id: string }) {
  const dispatch = useDispatch();
  const state = useSelector((s) => s);
  console.log("state", state);
  // const user = useSelector((s) => schema.users.selectById(s, { id }));
  // const userList = useSelector(schema.users.selectTableAsList);
  return (
    <div>
      <div>hi there, user.name</div>
      <button onClick={() => dispatch(createFolder())}>Fetch users</button>
      {/* {userList.map((u) => {
        return (
          <div key={u.id}>
            ({u.id}) {u.name}; age {u.age}
          </div>
        );
      })} */}
    </div>
  );
}

export default App;
