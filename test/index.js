import test from "node:test";
import assert from "node:assert";
import * as manivelle from "../src/index.js";

async function toArray(iterable) {
  const result = [];
  for await (const value of iterable) {
    result.push(value);
  }
  return result;
}

test("yield simple values", async (t) => {
  const result = await toArray(manivelle.tag`${1} ${"Hello"} ${[1, 2, 3]}`);

  assert.deepStrictEqual(result, ["", 1, " ", "Hello", " ", [1, 2, 3], ""]);
});

test("yield values of async generators", async (t) => {
  async function* generator() {
    yield 1;
    yield 2;
    yield 3;
  }
  const result = await toArray(manivelle.tag`start ${generator}`);

  assert.deepStrictEqual(result, ["start ", 1, 2, 3, ""]);
});

test("flatten values of async generators", async (t) => {
  async function* generator() {
    yield manivelle.tag`hello`;
    yield manivelle.tag`world`;
  }
  const result = await toArray(manivelle.tag`start ${generator}`);

  assert.deepStrictEqual(result, ["start ", "hello", "world", ""]);
});

test("async generators are started eagerly", (t) => {
  let counter = 0;

  async function* generator() {
    counter++;
    // Will never resolve
    await new Promise(() => {});
    assert.fail("unreacheable");
  }

  manivelle.tag`${generator} ${generator} ${generator}`.next();

  assert.equal(counter, 3);
});

test("async generators are consumed eagerly", async (t) => {
  async function* pending() {
    // Will never resolve
    await new Promise(() => {});
    assert.fail("unreacheable");
  }

  let counter = 0;

  async function* generator() {
    yield 1;
    await new Promise((resolve) => setImmediate(resolve));
    yield 2;
    counter++;
  }

  // If the async generators are not consumed eagerly, the first
  // "pending" generator will block the following from progressing
  await manivelle.tag`${pending} ${generator} ${generator}`.next();

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(counter, 2);
});

test("async generators are flattened eagerly", async (t) => {
  async function* pending() {
    // Will never resolve
    await new Promise(() => {});
    assert.fail("unreacheable");
  }

  let counter = 0;
  let subcounter = 0;

  async function* subgenerator() {
    subcounter++;
  }

  async function* generator() {
    // If the async generators are not flattened eagerly, the first
    // "pending" generator will block the following from progressing

    yield pending();
    yield subgenerator();
    counter++;
  }

  await manivelle.tag`${generator} ${generator}`.next();

  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(counter, 2);
  assert.equal(subcounter, 2);
});

test("errors are not discarded", async (t) => {
  async function* generator() {
    throw new Error("user error");
  }

  try {
    await toArray(manivelle.tag`${generator}`);
    assert.fail("Error not thrown");
  } catch (error) {
    assert.equal(error.message, "user error");
  }
});

test("html is escaped", async (t) => {
  const result = await toArray(manivelle.html`<p>${"<script></script>"}</p>`);

  assert.deepStrictEqual(result.map(String), [
    "<p>",
    "&lt;script&gt;&lt;/script&gt;",
    "</p>",
  ]);
});

test("unsafeHtml is not escaped", async (t) => {
  const result = await toArray(
    manivelle.html`<p>${manivelle.unsafeHtml("<script></script>")}</p>`
  );

  assert.deepStrictEqual(result.map(String), [
    "<p>",
    "<script></script>",
    "</p>",
  ]);
});

test("html don't escape subtemplates", async (t) => {
  const list = ["Element 1", "Element 2"];
  async function* renderList() {
    for (const element of list) {
      yield manivelle.html`<li>${element}</li>`;
    }
  }

  const result = await toArray(manivelle.html`<ul>${renderList}</ul>`);

  assert.deepStrictEqual(result.map(String), [
    "<ul>",
    "<li>",
    "Element 1",
    "</li>",
    "<li>",
    "Element 2",
    "</li>",
    "</ul>",
  ]);
});
