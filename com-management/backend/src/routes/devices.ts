import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import UAClient from '../services/ua';
import { getCredentials, getServer } from '../services/sessionStore';

const router = Router();

const getUaClientFromSession = async (req: Request): Promise<UAClient> => {
  const sessionId = req.cookies.FCOM_SESSION_ID;
  if (!sessionId) {
    throw new Error('No active session');
  }

  const auth = await getCredentials(sessionId);
  const server = await getServer(sessionId);
  if (!auth || !server) {
    throw new Error('Session not found or expired');
  }

  const insecureTls = (process.env.UA_TLS_INSECURE ?? 'false').toLowerCase() === 'true';
  return new UAClient({
    hostname: server.hostname,
    port: server.port,
    auth_method: auth.auth_type,
    username: auth.username,
    password: auth.password,
    cert_path: auth.cert_path,
    key_path: auth.key_path,
    ca_cert_path: auth.ca_cert_path,
    insecure_tls: insecureTls,
  });
};

const extractRows = (payload: any) => {
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  return [] as any[];
};

const normalizeDevices = (rows: any[]) =>
  rows
    .map((entry) => {
      const deviceId = String(
        entry?.DeviceID ?? entry?.device_id ?? entry?.id ?? entry?.ID ?? '',
      ).trim();
      const name = String(
        entry?.DeviceName ??
          entry?.device_name ??
          entry?.CustomName ??
          entry?.custom_name ??
          entry?.Name ??
          entry?.name ??
          entry?.Node ??
          entry?.Hostname ??
          entry?.HostName ??
          '',
      ).trim();
      const zoneName = String(
        entry?.DeviceZoneName ??
          entry?.device_zone_name ??
          entry?.ZoneName ??
          entry?.zone_name ??
          entry?.Zone ??
          entry?.ZoneID ??
          entry?.DeviceZoneID ??
          '',
      ).trim();
      const status = String(
        entry?.DeviceStatus ?? entry?.device_status ?? entry?.Status ?? entry?.status ?? '',
      ).trim();
      const sysOid = String(
        entry?.SysOID ?? entry?.sys_oid ?? entry?.SysObjectID ?? entry?.sysObjectID ?? '',
      ).trim();
      const ip = String(
        entry?.IPAddress ??
          entry?.ip_address ??
          entry?.IP ??
          entry?.IpAddress ??
          entry?.ip ??
          entry?.NodeIP ??
          entry?.NodeIp ??
          entry?.HostAddress ??
          '',
      ).trim();
      const snmpAccessId = String(
        entry?.DeviceSNMPAccessID ?? entry?.device_snmp_access_id ?? '',
      ).trim();
      if (!name) {
        return null;
      }
      return {
        id: deviceId || name,
        name,
        zoneName,
        ip,
        status,
        sysOid,
        snmpAccessId,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        id: string;
        name: string;
        zoneName: string;
        ip: string;
        status: string;
        sysOid: string;
        snmpAccessId: string;
      } => Boolean(entry),
    );

router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit ?? 500);
    const start = Number(req.query.start ?? 0);
    const uaClient = await getUaClientFromSession(req);
    const data = await uaClient.getDevices({
      limit: Number.isFinite(limit) ? limit : 500,
      start: Number.isFinite(start) ? start : 0,
      excludeMetadata: false,
    });
    const rows = extractRows(data);
    const devices = normalizeDevices(rows)
      .filter((device) => device.sysOid)
      .filter((device) => device.status.toLowerCase() === 'discovered');
    res.json({
      devices,
      total: data?.total ?? data?.Total ?? rows.length,
      start,
      limit,
    });
  } catch (error: any) {
    logger.error(`Devices list error: ${error.message}`);
    res.status(500).json({ error: error.message || 'Failed to load devices' });
  }
});

export default router;
