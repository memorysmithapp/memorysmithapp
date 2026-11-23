/** The stylesheet lint: only the rule that keeps the tokens (#544, ADR-032). */
import tokenValues from './stylelint/token-values.mjs';

export default {
  plugins: [tokenValues],
  rules: {
    'memorysmith/token-values': true,
  },
};
