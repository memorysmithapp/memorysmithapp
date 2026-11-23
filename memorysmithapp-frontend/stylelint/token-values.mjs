/**
 * The values of the interface are its tokens (#544, ADR-032): a colour, a
 * font size or a radius written as a literal outside `@layer tokens` is
 * refused, so the next screen cannot drift from the brand without CI saying
 * so. A custom property may hold a literal colour only inside that layer.
 */
import stylelint from 'stylelint';

const {
  createPlugin,
  utils: { report, ruleMessages },
} = stylelint;

const ruleName = 'memorysmith/token-values';
const messages = ruleMessages(ruleName, {
  colour: (value) => `A colour is a token of @layer tokens, not "${value}" (#544).`,
  size: (value) => `A font size is a var(--text-*) of the type scale, not "${value}" (#544).`,
  radius: (value) => `A radius is a var(--radius-*), 0 or 50%, not "${value}" (#544).`,
});

const NAMED = [
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
  'navy',
  'teal',
  'silver',
  'maroon',
  'olive',
  'lime',
  'aqua',
  'fuchsia',
  'cyan',
  'magenta',
  'gold',
  'indigo',
  'violet',
  'tomato',
];
const COLOUR = new RegExp(
  String.raw`#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![-\w])(?:${NAMED.join('|')})(?![-\w])`,
  'i',
);
// A mask is drawn in alpha: its black is coverage, never a colour.
const ALPHA = /^(?:-webkit-)?mask(?:-image)?$/;
const SIZE =
  /^(?:var\(--(?:text-[a-z0-9]+|h[1-6]-size|title-size)\)|inherit|\d*\.?\d+(?:em|pt|%))$/;
const RADIUS = /^(?:0|50%|inherit|var\(--radius-[a-z0-9]+\))$/;
const LITERAL_SIZE = /(?:^|\s)\d*\.?\d+(?:px|rem)(?:\/|\s|$)/;

const inTokens = (node) => {
  for (let p = node.parent; p; p = p.parent) {
    if (p.type === 'atrule' && p.name === 'layer' && p.params.trim() === 'tokens') return true;
  }
  return false;
};

const rule = (enabled) => (root, result) => {
  if (!enabled) return;
  root.walkDecls((decl) => {
    const prop = decl.prop.toLowerCase();
    const value = decl.value.replace(/url\((?:[^()]|\([^)]*\))*\)/g, 'url()');
    const flag = (message) => report({ ruleName, result, node: decl, message, word: decl.value });

    if (prop.startsWith('--')) {
      if (!inTokens(decl) && COLOUR.test(value)) flag(messages.colour(decl.value));
      return;
    }
    if (!ALPHA.test(prop) && COLOUR.test(value)) flag(messages.colour(decl.value));
    if (prop === 'font-size' && !SIZE.test(value.trim())) flag(messages.size(decl.value));
    if (prop === 'font' && LITERAL_SIZE.test(value)) flag(messages.size(decl.value));
    if (/^border(?:-[a-z]+)*-radius$/.test(prop) || prop === 'border-radius') {
      if (
        !value
          .trim()
          .split(/\s+/)
          .every((part) => RADIUS.test(part))
      )
        flag(messages.radius(decl.value));
    }
  });
};
rule.ruleName = ruleName;
rule.messages = messages;

export default createPlugin(ruleName, rule);
