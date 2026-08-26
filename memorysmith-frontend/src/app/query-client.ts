import { QueryClient } from '@tanstack/react-query';

// The seed is static, so queries never go stale while the mock adapter is in
// place. The real HTTP client will bring its own staleness policy.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      retry: false,
    },
  },
});
