import { http, createConfig, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected } from 'wagmi/connectors';

export const config = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: 'XanLens',
      preference: { options: 'all' },
    }),
    injected(),
  ],
  ssr: true,
  storage: createStorage({ storage: typeof window !== 'undefined' ? window.localStorage : undefined }),
  transports: {
    [base.id]: http(),
  },
});
