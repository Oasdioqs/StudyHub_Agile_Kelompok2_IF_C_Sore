export default function KelasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-fluid py-3">
      {children}
    </div>
  )
}
