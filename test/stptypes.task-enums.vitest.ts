import { describe, it, expect } from 'vitest';
import * as StpType from '../src/stptypes';

/**
 * TaskWhat / TaskHow membership after STP-1001 and STP-1019.
 *
 * The engine renamed HARRASSMENT_FIRES to HARASSMENT_FIRES and stopped
 * producing the civilian-behaviour whats and the actor-class hows. The old
 * members stay (deprecated) so values from older servers or saved data still
 * compare; removing them is a next-major change, and this pins that they are
 * still here until then.
 */
describe('task enums (STP-1001, STP-1019)', () => {
  it('has the corrected HarassmentFires spelling', () => {
    expect(StpType.TaskWhat.HarassmentFires).toBe('HARASSMENT_FIRES');
  });

  it('keeps the deprecated TaskWhat members', () => {
    expect(StpType.TaskWhat.HarrassmentFires).toBe('HARRASSMENT_FIRES');
    expect(StpType.TaskWhat.Looting).toBe('LOOTING');
    expect(StpType.TaskWhat.Rioting).toBe('RIOTING');
    expect(StpType.TaskWhat.SeekRefuge).toBe('SEEK_REFUGE');
  });

  it('keeps the deprecated TaskHow members', () => {
    expect(StpType.TaskHow.Civilian).toBe('CIVILIAN');
    expect(StpType.TaskHow.Insurgent).toBe('INSURGENT');
    expect(StpType.TaskHow.NgoOperation).toBe('NGO_OPERATION');
  });
});
