import { UAServer } from '../types';

const uaServers: Map<string, UAServer> = new Map([
  [
    'lab-ua-tony02',
    {
      server_id: 'lab-ua-tony02',
      server_name: 'Lab UA (Tony02) (lab-ua-tony02.tony.lab)',
      hostname: 'lab-ua-tony02.tony.lab',
      port: 443,
      environment: 'dev',
      svn_url: 'svn://lab-ua-tony02.tony.lab/fcom',
    },
  ],
  [
    'dev-ua-01',
    {
      server_id: 'dev-ua-01',
      server_name: 'Development UA Primary',
      hostname: 'ua-dev.example.com',
      port: 8080,
      environment: 'dev',
      svn_url: 'svn://ua-dev.example.com/fcom',
    },
  ],
  [
    'test-ua-01',
    {
      server_id: 'test-ua-01',
      server_name: 'Test UA Primary',
      hostname: 'ua-test.example.com',
      port: 8080,
      environment: 'test',
      svn_url: 'svn://ua-test.example.com/fcom',
    },
  ],
  [
    'prod-ua-01',
    {
      server_id: 'prod-ua-01',
      server_name: 'Production UA Primary',
      hostname: 'ua-prod.example.com',
      port: 8080,
      environment: 'prod',
      svn_url: 'svn://ua-prod.example.com/fcom',
    },
  ],
]);

export const listServers = (): UAServer[] => Array.from(uaServers.values());

export const getServerById = (serverId: string): UAServer | undefined =>
  uaServers.get(serverId);
