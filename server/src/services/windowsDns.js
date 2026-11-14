import { execFileSync } from 'node:child_process';
import dns from 'node:dns';
import { isIP } from 'node:net';

export function configureWindowsDnsResolver() {
  if (process.platform !== 'win32') return false;

  const output = execFileSync('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-Command',
    '$ErrorActionPreference = "Stop"; Get-DnsClientServerAddress -AddressFamily IPv4 | ForEach-Object { $_.ServerAddresses } | Where-Object { $_ } | Select-Object -Unique',
  ], {
    encoding: 'utf8',
    timeout: 30000,
    windowsHide: true,
  });
  const servers = [...new Set(output.split(/\r?\n/).map((server) => server.trim()).filter((server) => isIP(server)))];
  if (servers.length === 0) return false;

  dns.setServers(servers);
  return true;
}
