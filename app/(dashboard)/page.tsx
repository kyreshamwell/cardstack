// app/(dashboard)/page.tsx — the main dashboard at "/dashboard".
//
// This is where the card grid will live once we connect Plaid.
// For now it's a placeholder so we can confirm the auth + routing works
// before building any real UI.

export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Your Cards</h1>
      <p className="mt-2 text-slate-500">
        Connect your first card to get started.
      </p>

      {/*
        TODO (next session):
        - Add "Connect a card" button that opens the Plaid Link flow
        - Render a CardSummary component for each connected account
      */}
    </div>
  )
}
