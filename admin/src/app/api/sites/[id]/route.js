import { NextResponse } from 'next/server';

const API_URL = process.env.API_URL;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

function backendHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${ADMIN_SECRET}`,
  };
}

export async function GET(request, { params }) {
  const res = await fetch(`${API_URL}/sites/${params.id}`, { headers: backendHeaders() });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function PUT(request, { params }) {
  const body = await request.json();
  const res = await fetch(`${API_URL}/sites/${params.id}`, {
    method: 'PUT',
    headers: backendHeaders(),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export async function DELETE(request, { params }) {
  const res = await fetch(`${API_URL}/sites/${params.id}`, {
    method: 'DELETE',
    headers: backendHeaders(),
  });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
