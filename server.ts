import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { tmbService } from './server/tmbService';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Boot background load of TMB transit lines and stops immediately
tmbService.loadFullNetwork().catch((err) => {
  console.warn('[Server] Initial TMB background load notice:', err?.message || err);
});

// Transit API status endpoint
app.get('/api/transit/status', async (req, res) => {
  const status = tmbService.getStatus();

  // If not yet verified and configured, trigger a quick verify or load
  if (status.configured && !status.verified && !status.isLoading) {
    tmbService.loadFullNetwork().catch(() => {});
  }

  res.json({
    status: 'ok',
    primaryCity: 'Barcelona',
    coverage: ['Barcelona (TMB iBus Oficial)'],
    tmb: {
      configured: status.configured,
      verified: status.verified,
      appIdProvided: status.appIdProvided,
      providerName: status.providerName,
      portalUrl: status.portalUrl,
      statusNote: status.statusNote,
      linesCount: status.linesCount,
      stopsCount: status.stopsCount,
      lastUpdated: status.lastUpdated,
      isLoading: status.isLoading,
    },
    message: status.configured
      ? (status.verified
          ? `Conexión oficial activa con TMB Barcelona: ${status.linesCount} líneas y ${status.stopsCount} paradas en tiempo real.`
          : status.statusNote)
      : 'Red oficial TMB Barcelona activa. Para tiempos en directo por GPS, añade tus claves de developer.tmb.cat en .env.',
  });
});

// Barcelona all lines list (126+ lines from TMB)
app.get('/api/transit/barcelona/lines', async (req, res) => {
  if (req.query.refresh === 'true') {
    await tmbService.loadFullNetwork(true);
  }
  const lines = tmbService.getLines();
  res.json({
    success: true,
    total: lines.length,
    lines,
  });
});

// Barcelona all stops list (2,719+ stops from TMB)
app.get('/api/transit/barcelona/stops', async (req, res) => {
  if (req.query.refresh === 'true') {
    await tmbService.loadFullNetwork(true);
  }

  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lng = req.query.lng ? Number(req.query.lng) : undefined;
  const radius = req.query.radius ? Number(req.query.radius) : undefined;

  const stops = tmbService.getStops({
    lat,
    lng,
    radiusMeters: radius,
  });

  res.json({
    success: true,
    total: stops.length,
    stops,
  });
});

// Real-time arrivals for a Barcelona stop by code
app.get('/api/transit/barcelona/arrivals/:stopCode', async (req, res) => {
  const result = await tmbService.getRealtimeArrivals(req.params.stopCode);
  res.json(result);
});

// Manual refresh trigger
app.post('/api/transit/barcelona/refresh', async (req, res) => {
  try {
    await tmbService.loadFullNetwork(true);
    const status = tmbService.getStatus();
    res.json({
      success: true,
      linesCount: status.linesCount,
      stopsCount: status.stopsCount,
      statusNote: status.statusNote,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error refreshing TMB data' });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BusTiempo Server running on http://localhost:${PORT}`);
  });
}

startServer();
