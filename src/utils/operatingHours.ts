import { BusLine } from '../types/transit';

export interface OperatingStatus {
  inService: boolean;
  scheduleText: string;
  statusBadge: string;
  statusColor: string; // Tailwind color class
  reason?: string;
  nextServiceTime?: string;
}

/**
 * Returns the current time in Barcelona (Europe/Madrid timezone)
 */
export function getBarcelonaTime(customDate?: Date): {
  hour: number;
  minute: number;
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  formattedTime: string;
} {
  const d = customDate || new Date();
  try {
    const formatter = new Intl.DateTimeFormat('es-ES', {
      timeZone: 'Europe/Madrid',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    let hour = d.getHours();
    let minute = d.getMinutes();

    for (const part of parts) {
      if (part.type === 'hour') hour = parseInt(part.value, 10);
      if (part.type === 'minute') minute = parseInt(part.value, 10);
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      hour,
      minute,
      dayOfWeek: d.getDay(),
      formattedTime: `${pad(hour)}:${pad(minute)}`,
    };
  } catch {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return {
      hour: d.getHours(),
      minute: d.getMinutes(),
      dayOfWeek: d.getDay(),
      formattedTime: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    };
  }
}

/**
 * Parses "HH:MM" into minutes from midnight (0 to 1439)
 */
function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if a given time in minutes falls within a window that may span midnight.
 * e.g., 22:15 (1335) to 05:30 (330)
 */
function isTimeWithinWindow(currentMinutes: number, startMinutes: number, endMinutes: number): boolean {
  if (startMinutes <= endMinutes) {
    // Normal daytime window (e.g. 05:30 to 22:45)
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } else {
    // Overnight window (e.g. 22:15 to 05:30)
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}

/**
 * Checks if a transit line is currently running in Barcelona according to real operational schedules
 */
export function getLineOperatingStatus(line: BusLine, customDate?: Date): OperatingStatus {
  const { hour, minute, dayOfWeek, formattedTime } = getBarcelonaTime(customDate);
  const currentMinutes = hour * 60 + minute;

  const transportType = line.transportType || (line.code.startsWith('L') ? 'metro' : 'bus');

  // 1. Nitbus (AMB Night Bus - lines N1 to N28)
  if (transportType === 'nitbus' || line.isNightLine || line.code.startsWith('N')) {
    const startStr = line.operatingHours?.start || '22:15';
    const endStr = line.operatingHours?.end || '05:30';
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);
    const inService = isTimeWithinWindow(currentMinutes, startMin, endMin);

    if (inService) {
      return {
        inService: true,
        scheduleText: `${startStr} - ${endStr} (Nocturno)`,
        statusBadge: '🌙 Nitbus en servicio',
        statusColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
        nextServiceTime: 'Operando ahora hasta las ' + endStr,
      };
    } else {
      return {
        inService: false,
        scheduleText: `${startStr} - ${endStr} (Nocturno)`,
        statusBadge: '🌙 Servicio finalizado (Reanuda 22:15)',
        statusColor: 'text-slate-400 bg-slate-800/80 border-slate-700/60',
        reason: 'Línea de Nitbus activa solo durante horario nocturno.',
        nextServiceTime: 'Próxima salida a las ' + startStr,
      };
    }
  }

  // 2. Metro de Barcelona (TMB L1, L2, L3, L4, L5, L9, L10, L11)
  if (transportType === 'metro') {
    // Metro schedule rules in Barcelona:
    // Sunday - Thursday: 05:00 - 00:00 (midnight)
    // Friday: 05:00 - 02:00
    // Saturday: Continuous 24 hours until Sunday 00:00
    let inService = false;
    let scheduleStr = '05:00 - 00:00';

    if (dayOfWeek === 6) {
      // Saturday: continuous 24h
      inService = true;
      scheduleStr = 'Servicio continuo 24h';
    } else if (dayOfWeek === 5) {
      // Friday: 05:00 to 02:00 (of Saturday)
      inService = isTimeWithinWindow(currentMinutes, 5 * 60, 2 * 60);
      scheduleStr = '05:00 - 02:00';
    } else if (dayOfWeek === 0) {
      // Sunday: up to 00:00
      inService = currentMinutes >= 5 * 60; // since Saturday ran 24h, morning is already covered
      scheduleStr = '05:00 - 00:00';
    } else {
      // Mon - Thu: 05:00 to 00:00
      inService = currentMinutes >= 5 * 60; // 00:00 is midnight
      scheduleStr = '05:00 - 00:00';
    }

    if (inService) {
      return {
        inService: true,
        scheduleText: scheduleStr,
        statusBadge: '🚇 Metro en servicio',
        statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        nextServiceTime: 'Operando',
      };
    } else {
      return {
        inService: false,
        scheduleText: scheduleStr,
        statusBadge: '🚇 Metro cerrado (Abre 05:00)',
        statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
        reason: 'El servicio de metro finaliza a medianoche entre semana.',
        nextServiceTime: 'Próxima apertura a las 05:00',
      };
    }
  }

  // 3. Rodalies de Catalunya (Renfe R1, R2, R3, R4, RG1)
  if (transportType === 'rodalies') {
    const startStr = line.operatingHours?.start || '05:15';
    const endStr = line.operatingHours?.end || '23:45';
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);
    const inService = isTimeWithinWindow(currentMinutes, startMin, endMin);

    if (inService) {
      return {
        inService: true,
        scheduleText: `${startStr} - ${endStr}`,
        statusBadge: '🚆 Rodalies en servicio',
        statusColor: 'text-sky-400 bg-sky-500/10 border-sky-500/30',
        nextServiceTime: 'Operando hasta ' + endStr,
      };
    } else {
      return {
        inService: false,
        scheduleText: `${startStr} - ${endStr}`,
        statusBadge: '🚆 Servicio finalizado (Reanuda 05:15)',
        statusColor: 'text-slate-400 bg-slate-800/80 border-slate-700/60',
        reason: 'Trenes de Rodalies fuera de servicio durante la madrugada.',
        nextServiceTime: 'Próximo tren a las ' + startStr,
      };
    }
  }

  // 4. FGC (Ferrocarrils de la Generalitat: L6, L7, L8, L12, S1, S2)
  if (transportType === 'fgc') {
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const startStr = '05:10';
    const endStr = isWeekend ? '02:00' : '00:00';
    const startMin = parseTimeToMinutes(startStr);
    const endMin = parseTimeToMinutes(endStr);
    const inService = isTimeWithinWindow(currentMinutes, startMin, endMin);

    if (inService) {
      return {
        inService: true,
        scheduleText: `${startStr} - ${endStr}`,
        statusBadge: '🚉 FGC en servicio',
        statusColor: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
        nextServiceTime: 'Operando hasta ' + endStr,
      };
    } else {
      return {
        inService: false,
        scheduleText: `${startStr} - ${endStr}`,
        statusBadge: '🚉 FGC cerrado (Reanuda 05:10)',
        statusColor: 'text-slate-400 bg-slate-800/80 border-slate-700/60',
        reason: 'Línea de tren FGC cerrada hasta las 05:10.',
        nextServiceTime: 'Primer tren a las ' + startStr,
      };
    }
  }

  // 5. Standard daytime bus (TMB H12, V15, D20, D40, 24, 7, 59, H8, etc.)
  const startStr = line.operatingHours?.start || '05:30';
  const endStr = line.operatingHours?.end || '22:45';
  const startMin = parseTimeToMinutes(startStr);
  const endMin = parseTimeToMinutes(endStr);
  const inService = isTimeWithinWindow(currentMinutes, startMin, endMin);

  if (inService) {
    return {
      inService: true,
      scheduleText: `${startStr} - ${endStr}`,
      statusBadge: '🚌 En servicio',
      statusColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      nextServiceTime: 'Operando hasta ' + endStr,
    };
  } else {
    return {
      inService: false,
      scheduleText: `${startStr} - ${endStr}`,
      statusBadge: '🌙 Servicio diurno finalizado (Reanuda 05:30)',
      statusColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
      reason: 'El servicio diurno ha terminado. Para viajar de noche, consulta las líneas de Nitbus.',
      nextServiceTime: 'Primer servicio a las ' + startStr,
    };
  }
}
