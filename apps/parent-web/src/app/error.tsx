"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <main className="container"><h1>Não foi possível abrir esta página.</h1><p>Tente novamente. Seus dados já salvos continuam guardados.</p><button onClick={reset}>Tentar novamente</button><a href="/login"> Voltar para o acesso</a></main>; }
