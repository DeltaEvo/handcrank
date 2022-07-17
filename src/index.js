function isAsyncIterator(value) {
  return typeof value === "object" && Symbol.asyncIterator in value;
}

function eagerNext(iterator) {
  return iterator.next().then((result) => {
    if (isAsyncIterator(result.value)) {
      result.value = eagerAsyncIterator(result.value);
    }
    if (result.done) {
      return [result];
    } else {
      return [result, eagerNext(iterator)];
    }
  });
}

function eagerAsyncIterator(iterator) {
  let value = eagerNext(iterator);
  return {
    async next() {
      const [result, nextValue] = await value;
      value = nextValue;
      return result;
    },
    [Symbol.asyncIterator]() {
      return this;
    },
  };
}

async function* flatten(iterable) {
  for await (const value of iterable) {
    if (isAsyncIterator(value)) {
      yield* flatten(value);
    } else {
      yield value;
    }
  }
}

const AsyncGeneratorConstructor = async function* () {}.constructor;

export function factory({ mapValue = (x) => x, mapTemplate = (x) => x }) {
  return async function* tag(strings, ...values) {
    const newValues = values.map((value) => {
      if (value instanceof AsyncGeneratorConstructor) {
        return eagerAsyncIterator(value());
      } else {
        return value;
      }
    });

    for await (const [i, value] of newValues.entries()) {
      yield mapTemplate(strings[i]);

      if (isAsyncIterator(value)) {
        for await (const subvalue of flatten(value)) {
          yield mapValue(subvalue);
        }
      } else {
        yield mapValue(value);
      }
    }
    yield mapTemplate(strings[strings.length - 1]);
  };
}

export const tag = factory({});

const raw = Symbol("raw");
class UnsafeHtml {
  constructor(value) {
    this[raw] = value;
  }
  toString() {
    return this[raw];
  }
}

export function unsafeHtml(value) {
  return new UnsafeHtml(value);
}

export const html = factory({
  mapValue(value) {
    if (value instanceof UnsafeHtml) return value;
    // https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html#output-encoding-for-html-contexts
    return `${value}`.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#x27;",
        }[c])
    );
  },
  mapTemplate: unsafeHtml,
});
