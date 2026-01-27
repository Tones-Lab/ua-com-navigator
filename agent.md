# Agent Notes

## FCOM Curator Services (systemd)

The application now runs as systemd services on this host.

### Service Names
- fcom-curator-backend.service
- fcom-curator-frontend.service

### Service Files
- /etc/systemd/system/fcom-curator-backend.service
- /etc/systemd/system/fcom-curator-frontend.service

### Common Commands

Reload systemd after changes:
- sudo systemctl daemon-reload

Enable services on boot:
- sudo systemctl enable fcom-curator-backend
- sudo systemctl enable fcom-curator-frontend

Start services:
- sudo systemctl start fcom-curator-backend
- sudo systemctl start fcom-curator-frontend

Stop services:
- sudo systemctl stop fcom-curator-backend
- sudo systemctl stop fcom-curator-frontend

Restart services:
- sudo systemctl restart fcom-curator-backend
- sudo systemctl restart fcom-curator-frontend

Check status:
- sudo systemctl status fcom-curator-backend
- sudo systemctl status fcom-curator-frontend

Logs:
- sudo journalctl -u fcom-curator-backend -f
- sudo journalctl -u fcom-curator-frontend -f

### Runtime Notes
- Backend working directory: /root/navigator/fcom-curator/backend
- Frontend working directory: /root/navigator/fcom-curator/frontend
- Backend uses EnvironmentFile: /root/navigator/fcom-curator/backend/.env (optional; ignored if missing)
- Both services run in development mode (npm run dev)
- Default ports: backend 3001, frontend 5173
- Services are enabled and running
