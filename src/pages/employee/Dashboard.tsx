import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Clock, MapPin, LogOut } from 'lucide-react';
import type { Location, AttendanceRecord } from '../../types/database';

export default function EmployeeDashboard() {
  const { user, signOut } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [task, setTask] = useState<string>('');
  const [comments, setComments] = useState<string>('');

  const [activeRecord, setActiveRecord] = useState<AttendanceRecord | null>(null);
  const [monthlyHours, setMonthlyHours] = useState<number>(0);

  useEffect(() => {
    fetchLocations();
    fetchActiveRecord();
    calculateMonthlyHours();
  }, []);

  // -------------------------------------------
  // Fetch locations
  // -------------------------------------------
  async function fetchLocations() {
    const { data, error } = await supabase
      .from('locations')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error fetching locations:', error);
      return;
    }

    setLocations(data || []);
  }

  // -------------------------------------------
  // Fetch any currently "active" record (check_out = null)
  // -------------------------------------------
  async function fetchActiveRecord() {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('profile_id', user?.id)
      .is('check_out', null)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching active record:', error);
      return;
    }

    setActiveRecord(data);
  }

  // -------------------------------------------
  // Calculate monthly hours (only for shifts that are already checked out)
  // -------------------------------------------
  async function calculateMonthlyHours() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('attendance_records')
      .select('check_in, check_out')
      .eq('profile_id', user?.id)
      .gte('check_in', startOfMonth.toISOString())
      .not('check_out', 'is', null);

    if (error) {
      console.error('Error calculating monthly hours:', error);
      return;
    }

    const totalHours = (data || []).reduce((acc, record) => {
      const checkIn = new Date(record.check_in);
      const checkOut = new Date(record.check_out!);
      const hours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
      return acc + hours;
    }, 0);

    setMonthlyHours(totalHours);
  }

  // -------------------------------------------
  // Handle Check In
  // -------------------------------------------
  async function handleCheckIn() {
    if (!selectedLocation) return;

    const { error } = await supabase
      .from('attendance_records')
      .insert([
        {
          profile_id: user?.id,
          location_id: selectedLocation,
          check_in: new Date().toISOString(),
          task,
          comments,
        },
      ]);

    if (error) {
      console.error('Error checking in:', error);
      return;
    }

    // <-- ADDED: After a successful insert, refetch the active record
    await fetchActiveRecord();

    // <-- OPTIONAL: If you want to see monthly hours after partial check-in, you can refetch:
    // await calculateMonthlyHours();

    // Reset form fields
    setSelectedLocation('');
    setTask('');
    setComments('');
  }

  // -------------------------------------------
  // Handle Check Out
  // -------------------------------------------
  async function handleCheckOut() {
    if (!activeRecord) return;

    const { error } = await supabase
      .from('attendance_records')
      .update({ check_out: new Date().toISOString() })
      .eq('id', activeRecord.id);

    if (error) {
      console.error('Error checking out:', error);
      return;
    }

    // Clear the active record in local state
    setActiveRecord(null);

    // <-- ADDED: Recalculate monthly hours after checking out
    await calculateMonthlyHours();
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* NAV BAR */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-800">Mitarbeiter Dashboard</h1>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">
                {user?.first_name} {user?.last_name}
              </span>
              <button
                onClick={() => signOut()}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Abmelden
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="md:grid md:grid-cols-3 md:gap-6">
          {/* Left Panel: Monthly Overview */}
          <div className="md:col-span-1">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Monatliche Übersicht</h2>
              <div className="flex items-center justify-between">
                <Clock className="w-8 h-8 text-blue-500" />
                <div className="text-right">
                  <p className="text-sm text-gray-500">Gesamtstunden diesen Monat</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {monthlyHours.toFixed(2)}h
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel: Check In / Check Out */}
          <div className="mt-5 md:mt-0 md:col-span-2">
            <div className="bg-white shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  {activeRecord ? 'Aktuelle Schicht' : 'Neue Schicht beginnen'}
                </h2>

                {activeRecord ? (
                  <div>
                    <p className="text-sm text-gray-500 mb-4">
                      Eingecheckt seit:{' '}
                      {new Date(activeRecord.check_in).toLocaleString('de-DE')}
                    </p>
                    <button
                      onClick={handleCheckOut}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Auschecken
                    </button>
                  </div>
                ) : (
                  <form className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Standort
                      </label>
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      >
                        <option value="">Standort auswählen</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Aufgabe
                      </label>
                      <input
                        type="text"
                        value={task}
                        onChange={(e) => setTask(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Aufgabenbeschreibung"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Bemerkungen
                      </label>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        placeholder="Optionale Bemerkungen"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleCheckIn}
                      disabled={!selectedLocation}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      <Clock className="w-4 h-4 mr-2" />
                      Einchecken
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}