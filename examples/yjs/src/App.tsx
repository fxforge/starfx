import { useDispatch } from "starfx/react";
import "./App.css";
import { createFolder, useSelector } from "./thunks.js";

function App({ id }: { id: string }) {
  void id;
  const dispatch = useDispatch();
  const items = useSelector(
    (state: { data?: { items?: Array<{ id: string }> } }) =>
      state.data?.items ?? [],
  );
  console.log("items", items);
  // const user = useSelector((s) => schema.users.selectById(s, { id }));
  // const userList = useSelector(schema.users.selectTableAsList);
  return (
    <div>
      <div>hi there, make a folder perhaps?</div>
      <button onClick={() => dispatch(createFolder())}>Make folder</button>
      <div>folders: {items.length}</div>
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
