import { html } from "../src/index.js";

function render(tasks) {
  return html`
    <title>My Todo List</title>
    <meta charset="utf-8">
    ${renderList}
  `;

  async function* renderList() {
    if (tasks.length === 0) {
      yield html`<p>All caught up!</p>`;
    } else {
      yield html`<ul>`;
      for (const task of tasks) {
        yield html`<li>${task}</li>`;
      }
      yield html`</ul>`;
    }
  }
}

const result = render(["Clean the house", "Water the plants"]);

for await (const value of result) {
  console.log(String(value));
}
