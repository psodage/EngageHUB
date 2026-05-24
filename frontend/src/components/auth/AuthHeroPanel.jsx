import loginBg from "../../assets/login-bg.png";

function blockImageAccess(e) {
  e.preventDefault();
}

function HeroImagePanel({ className }) {
  return (
    <div
      className={`relative overflow-hidden bg-[#050510] select-none ${className}`}
      onContextMenu={blockImageAccess}
      onDragStart={blockImageAccess}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(${loginBg})`,
          WebkitTouchCallout: "none",
        }}
        draggable={false}
        onContextMenu={blockImageAccess}
        onDragStart={blockImageAccess}
      />
      <div
        aria-hidden
        className="absolute inset-0 z-10"
        onContextMenu={blockImageAccess}
        onDragStart={blockImageAccess}
      />
    </div>
  );
}

export default function AuthHeroPanel() {
  return (
    <>
      <HeroImagePanel className="h-36 shrink-0 lg:hidden" />
      <HeroImagePanel className="hidden h-full min-h-0 w-full shrink-0 lg:block lg:w-[42%]" />
    </>
  );
}
