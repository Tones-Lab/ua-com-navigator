import Modal from '../../components/Modal';

type DeviceOption = { label: string; value: string };

type PcomAdvancedSettingsModalProps = {
  open: boolean;
  pcomAdvancedTargetMode: 'device' | 'manual';
  setPcomAdvancedTargetMode: (value: 'device' | 'manual') => void;
  pcomAdvancedDeviceIp: string;
  setPcomAdvancedDeviceIp: (value: string) => void;
  pcomDevicesLoading: boolean;
  pcomDeviceOptions: DeviceOption[];
  pcomAdvancedManualIp: string;
  setPcomAdvancedManualIp: (value: string) => void;
  pcomAdvancedSnmpVersion: '1' | '2c' | '3';
  setPcomAdvancedSnmpVersion: (value: '1' | '2c' | '3') => void;
  pcomAdvancedCommunity: string;
  setPcomAdvancedCommunity: (value: string) => void;
  pcomAdvancedOidEnabled: boolean;
  setPcomAdvancedOidEnabled: (value: boolean | ((prev: boolean) => boolean)) => void;
  pcomAdvancedOidValue: string;
  setPcomAdvancedOidValue: (value: string) => void;
  pcomAdvancedSecurityLevel: 'noAuthNoPriv' | 'authNoPriv' | 'authPriv';
  setPcomAdvancedSecurityLevel: (value: 'noAuthNoPriv' | 'authNoPriv' | 'authPriv') => void;
  pcomAdvancedUsername: string;
  setPcomAdvancedUsername: (value: string) => void;
  pcomAdvancedAuthProtocol: string;
  setPcomAdvancedAuthProtocol: (value: string) => void;
  pcomAdvancedAuthPassword: string;
  setPcomAdvancedAuthPassword: (value: string) => void;
  pcomAdvancedPrivProtocol: string;
  setPcomAdvancedPrivProtocol: (value: string) => void;
  pcomAdvancedPrivPassword: string;
  setPcomAdvancedPrivPassword: (value: string) => void;
  pcomAdvancedEngineId: string;
  setPcomAdvancedEngineId: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
};

export default function PcomAdvancedSettingsModal({
  open,
  pcomAdvancedTargetMode,
  setPcomAdvancedTargetMode,
  pcomAdvancedDeviceIp,
  setPcomAdvancedDeviceIp,
  pcomDevicesLoading,
  pcomDeviceOptions,
  pcomAdvancedManualIp,
  setPcomAdvancedManualIp,
  pcomAdvancedSnmpVersion,
  setPcomAdvancedSnmpVersion,
  pcomAdvancedCommunity,
  setPcomAdvancedCommunity,
  pcomAdvancedOidEnabled,
  setPcomAdvancedOidEnabled,
  pcomAdvancedOidValue,
  setPcomAdvancedOidValue,
  pcomAdvancedSecurityLevel,
  setPcomAdvancedSecurityLevel,
  pcomAdvancedUsername,
  setPcomAdvancedUsername,
  pcomAdvancedAuthProtocol,
  setPcomAdvancedAuthProtocol,
  pcomAdvancedAuthPassword,
  setPcomAdvancedAuthPassword,
  pcomAdvancedPrivProtocol,
  setPcomAdvancedPrivProtocol,
  pcomAdvancedPrivPassword,
  setPcomAdvancedPrivPassword,
  pcomAdvancedEngineId,
  setPcomAdvancedEngineId,
  onClose,
  onApply,
}: PcomAdvancedSettingsModalProps) {
  if (!open) {
    return null;
  }

  return (
    <Modal className="modal-wide" ariaLabel="SNMP Advanced Settings">
      <h3>SNMP Advanced Settings</h3>
      <div className="panel-section">
        <div className="panel-section-title">Target</div>
        <div className="mib-trap-grid">
          <label className="mib-field">
            Target mode
            <select
              value={pcomAdvancedTargetMode}
              onChange={(e) => setPcomAdvancedTargetMode(e.target.value as 'device' | 'manual')}
            >
              <option value="device">Device list</option>
              <option value="manual">Manual IP</option>
            </select>
          </label>
          {pcomAdvancedTargetMode === 'device' ? (
            <label className="mib-field">
              Device
              <select
                value={pcomAdvancedDeviceIp}
                onChange={(e) => setPcomAdvancedDeviceIp(e.target.value)}
                disabled={pcomDevicesLoading}
              >
                <option value="">Select a device</option>
                {pcomDevicesLoading ? (
                  <option value="" disabled>
                    Loading devices...
                  </option>
                ) : pcomDeviceOptions.length === 0 ? (
                  <option value="" disabled>
                    No devices available
                  </option>
                ) : (
                  pcomDeviceOptions.map((device) => (
                    <option key={device.value} value={device.value}>
                      {device.label}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : (
            <label className="mib-field">
              IP address
              <input
                type="text"
                placeholder="10.0.0.10"
                value={pcomAdvancedManualIp}
                onChange={(e) => setPcomAdvancedManualIp(e.target.value)}
              />
            </label>
          )}
        </div>
      </div>
      <div className="panel-section">
        <div className="panel-section-title">SNMP</div>
        <div className="mib-trap-grid">
          <label className="mib-field">
            Version
            <select
              value={pcomAdvancedSnmpVersion}
              onChange={(e) => setPcomAdvancedSnmpVersion(e.target.value as '1' | '2c' | '3')}
            >
              <option value="1">v1</option>
              <option value="2c">v2c</option>
              <option value="3">v3</option>
            </select>
          </label>
          {(pcomAdvancedSnmpVersion === '1' || pcomAdvancedSnmpVersion === '2c') && (
            <label className="mib-field">
              Community string
              <input
                type="password"
                value={pcomAdvancedCommunity}
                onChange={(e) => setPcomAdvancedCommunity(e.target.value)}
              />
            </label>
          )}
        </div>
        <details className="mib-advanced-oid" open={pcomAdvancedOidEnabled}>
          <summary
            onClick={(e) => {
              e.preventDefault();
              setPcomAdvancedOidEnabled((prev) => !prev);
            }}
          >
            Customize OID (optional)
          </summary>
          {pcomAdvancedOidEnabled && (
            <div className="mib-advanced-oid-body">
              <label className="mib-field">
                OID override
                <input
                  type="text"
                  placeholder="1.3.6.1.4.1.x.y"
                  value={pcomAdvancedOidValue}
                  onChange={(e) => setPcomAdvancedOidValue(e.target.value)}
                />
              </label>
              <div className="muted">
                Defaults to the selected MIB OID. Append .x.y to target an instance.
              </div>
            </div>
          )}
        </details>
        {pcomAdvancedSnmpVersion === '3' && (
          <div className="mib-trap-grid">
            <label className="mib-field">
              Security level
              <select
                value={pcomAdvancedSecurityLevel}
                onChange={(e) =>
                  setPcomAdvancedSecurityLevel(
                    e.target.value as 'noAuthNoPriv' | 'authNoPriv' | 'authPriv',
                  )
                }
              >
                <option value="noAuthNoPriv">noAuthNoPriv</option>
                <option value="authNoPriv">authNoPriv</option>
                <option value="authPriv">authPriv</option>
              </select>
            </label>
            <label className="mib-field">
              Username
              <input
                type="text"
                value={pcomAdvancedUsername}
                onChange={(e) => setPcomAdvancedUsername(e.target.value)}
              />
            </label>
            {pcomAdvancedSecurityLevel !== 'noAuthNoPriv' && (
              <>
                <label className="mib-field">
                  Authentication protocol
                  <select
                    value={pcomAdvancedAuthProtocol}
                    onChange={(e) => setPcomAdvancedAuthProtocol(e.target.value)}
                  >
                    <option value="">Select protocol</option>
                    <option value="MD5">MD5</option>
                    <option value="SHA">SHA</option>
                    <option value="SHA-224">SHA (224)</option>
                    <option value="SHA-256">SHA (256)</option>
                    <option value="SHA-384">SHA (384)</option>
                    <option value="SHA-512">SHA (512)</option>
                  </select>
                </label>
                <label className="mib-field">
                  Authentication password
                  <input
                    type="password"
                    value={pcomAdvancedAuthPassword}
                    onChange={(e) => setPcomAdvancedAuthPassword(e.target.value)}
                  />
                </label>
              </>
            )}
            {pcomAdvancedSecurityLevel === 'authPriv' && (
              <>
                <label className="mib-field">
                  Privacy protocol
                  <select
                    value={pcomAdvancedPrivProtocol}
                    onChange={(e) => setPcomAdvancedPrivProtocol(e.target.value)}
                  >
                    <option value="">Select protocol</option>
                    <option value="DES">DES</option>
                    <option value="3DES">3DES</option>
                    <option value="AES-128">AES (128)</option>
                    <option value="AES-192">AES (192)</option>
                    <option value="AES-192-Cisco">AES (192) Cisco</option>
                    <option value="AES-256">AES (256)</option>
                    <option value="AES-256-Cisco">AES (256) Cisco</option>
                  </select>
                </label>
                <label className="mib-field">
                  Privacy password
                  <input
                    type="password"
                    value={pcomAdvancedPrivPassword}
                    onChange={(e) => setPcomAdvancedPrivPassword(e.target.value)}
                  />
                </label>
              </>
            )}
            <label className="mib-field">
              Engine ID
              <input
                type="text"
                value={pcomAdvancedEngineId}
                onChange={(e) => setPcomAdvancedEngineId(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
      <div className="modal-actions">
        <button type="button" className="ghost-button" onClick={onClose}>
          Close
        </button>
        <button type="button" className="modal-primary" onClick={onApply}>
          Apply
        </button>
      </div>
    </Modal>
  );
}
