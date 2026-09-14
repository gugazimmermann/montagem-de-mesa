/** Classes Tailwind compartilhadas do admin (tokens via @theme). Densidade slim. */

/** Escopo para `.btn` compactos via CSS (ver index.css). */
const adminSlim = 'admin-slim'

export const painel =
  `${adminSlim} mx-auto flex max-w-[720px] flex-col gap-4 px-4 pt-5 pb-8 max-[720px]:gap-3 max-[720px]:overflow-x-clip max-[720px]:px-3 max-[720px]:pt-4 max-[720px]:pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`

export const painelHeader =
  'flex flex-wrap items-end justify-between gap-2.5 max-[720px]:flex-col max-[720px]:items-stretch'

export const painelEyebrow =
  'm-0 text-[0.75rem] font-medium tracking-[0.04em] text-muted uppercase'

export const painelTitulo =
  'mt-[0.1rem] mb-0 font-display text-[clamp(1.35rem,3.5vw,1.55rem)] font-semibold'

export const painelAcoes =
  'flex flex-wrap gap-1.5 max-[720px]:w-full [&_.btn]:max-[720px]:flex-1 [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:flex-1 [&_a.btn]:max-[720px]:justify-center'

export const painelSecao =
  'rounded-lg border border-border bg-surface p-4 shadow-sm max-[720px]:overflow-visible max-[720px]:p-3 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-2.5 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold'

export const painelForm = 'flex flex-col gap-2.5'

export const painelFormAcoes =
  'flex flex-wrap gap-1.5 max-[720px]:flex-col-reverse [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:w-full [&_a.btn]:max-[720px]:justify-center'

export const painelLogoPreview =
  'w-fit rounded-md border border-border bg-surface-solid p-2 [&_img]:block [&_img]:max-h-10 [&_img]:w-auto [&_img]:object-contain'

export const field = 'flex flex-col gap-[0.25rem]'

export const fieldLabel = 'text-[0.75rem] font-medium text-muted'

export const fieldInput =
  'font-[inherit] rounded-sm border border-border bg-surface-solid px-3 py-2 text-sm text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

export const fieldDica = 'mt-[0.25rem] block text-[0.75rem] font-normal leading-[1.35] text-muted'

export const fieldErro = 'mt-[0.25rem] block text-[0.75rem] text-danger'

export const fieldSenha = 'relative'

export const fieldSenhaInput = `${fieldInput} box-border w-full pr-10`

export const fieldSenhaToggle =
  'absolute top-1/2 right-0.5 m-0 grid size-8 -translate-y-1/2 place-items-center rounded-sm border-none bg-transparent p-1 leading-none text-muted cursor-pointer enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

export const list = 'm-0 flex list-none flex-col gap-2 p-0'

export const listItem =
  'flex min-w-0 flex-wrap justify-between gap-2 overflow-visible rounded-md border border-border bg-surface-solid px-3 py-2.5 [&_>div:first-child]:min-w-0 [&_>div:first-child]:flex-[1_1_10rem] [&_p]:mt-[0.25rem] [&_p]:mb-0 [&_p]:text-sm [&_p]:text-muted'

export const listAcoes =
  'flex flex-wrap items-start justify-end gap-1 [&_a]:inline-flex [&_a]:items-center [&_a]:no-underline [&_.btn]:max-[720px]:px-2.5 [&_.btn]:max-[720px]:text-[0.8125rem]'

export const categoriasBadge =
  'ml-[0.3rem] inline-block align-middle rounded px-[0.4rem] py-[0.05rem] text-[0.65rem] font-semibold tracking-[0.04em] text-muted uppercase bg-surface-elevated'

export const categoriasQtd = 'text-[0.9em] font-normal text-muted'

export const categoriasId = 'mt-[0.1rem] block text-xs text-muted'

export const loginShell =
  `${adminSlim} grid min-h-screen place-items-center px-4 py-6 max-[480px]:items-start max-[480px]:px-3 max-[480px]:pt-4 max-[480px]:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]`

export const loginCard =
  'flex w-full max-w-96 flex-col gap-3 rounded-lg border border-border bg-surface px-5 py-5 shadow-md max-[480px]:px-4 max-[480px]:py-4'

export const loginForm = 'flex flex-col gap-2.5'

export const loginHeaderTitulo =
  'm-0 font-display text-[1.5rem] font-semibold max-[480px]:text-[1.35rem]'

export const loginHeaderSub = 'mt-[0.25rem] mb-0 text-sm text-muted'

export const loginRodape =
  'm-0 text-center text-[0.8125rem] text-muted [&_a]:font-medium [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline'

export const loginSubmit = 'mt-0.5 w-full'

export const loginAvisoEmail =
  'mt-1 mb-0 rounded-md border border-success-border bg-success-bg px-3 py-3 shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_12%,transparent)]'

export const loginAvisoEmailTitulo =
  'm-0 font-display text-[1.05rem] font-semibold leading-[1.25] text-success'

export const loginAvisoEmailTexto =
  'mt-1.5 mb-0 text-sm font-medium leading-[1.4] text-success'

export const alertaStack = 'flex flex-col gap-2'

const alertaBase = 'm-0 rounded-md border px-3 py-2.5'

export const alertaPorTipo: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: `${alertaBase} border-border bg-accent-bg`,
  success: `${alertaBase} border-success-border bg-success-bg`,
  warning: `${alertaBase} border-warning-border bg-warning-bg`,
  error: `${alertaBase} border-danger-border bg-danger-bg`,
}

export const alertaTitulo = 'mb-1.5 text-sm font-semibold'

export const alertaTituloPorTipo: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: alertaTitulo,
  success: `${alertaTitulo} text-success`,
  warning: `${alertaTitulo} text-warning`,
  error: `${alertaTitulo} text-danger`,
}

export const alertaCorpo =
  'm-0 text-[0.8125rem] leading-[1.4] text-muted [&_p]:mb-1.5 [&_p]:mt-0 [&_p:last-child]:mb-0'

export const alertaCorpoErro = `${alertaCorpo} text-danger`

export const estado =
  'flex flex-col items-center justify-center gap-2 px-4 py-6 text-center text-muted [&_p]:m-0'

export const estadoVazio = `${estado} rounded-lg border border-dashed border-border bg-surface`

export const estadoTitulo = 'text-base font-semibold text-text'

export const estadoDesc = 'max-w-md text-sm'

export const estadoSpinner =
  'size-5 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none motion-reduce:opacity-70'

export const skeleton = 'flex w-full flex-col gap-2'

export const skeletonLinha =
  'h-10 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,var(--surface-elevated)_0%,var(--border)_50%,var(--surface-elevated)_100%)] [background-size:200%_100%] motion-reduce:animate-none'

export const skeletonLinhaCurta = `${skeletonLinha} h-4 w-3/5`

export const breadcrumb = 'mb-2'

export const breadcrumbList =
  'm-0 flex list-none flex-wrap items-center gap-[0.3rem] p-0 text-[0.75rem] text-muted'

export const breadcrumbLink = 'text-accent no-underline hover:underline'

export const breadcrumbAtual = 'font-medium text-text'

export const modalBackdrop =
  `${adminSlim} fixed inset-0 z-40 grid place-items-center bg-[rgba(26,36,33,0.45)] p-3 max-[720px]:items-end max-[720px]:pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]`

export const modal =
  'w-[min(420px,100%)] rounded-lg border border-border bg-surface p-4 shadow-md max-[720px]:w-full max-[720px]:rounded-b-none [&_h2]:mb-1.5 [&_h2]:mt-0 [&_h2]:text-base [&_p]:mb-3.5 [&_p]:mt-0 [&_p]:text-sm [&_p]:text-muted'

export const modalAcoes =
  'flex flex-wrap justify-end gap-1.5 max-[720px]:flex-col-reverse max-[720px]:justify-stretch [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center'

export const menuMais = 'relative inline-block max-w-full w-max align-top'

export const menuMaisPainel =
  'absolute top-[calc(100%+0.25rem)] right-0 z-40 flex max-h-[min(70dvh,20rem)] min-w-44 max-w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-0.5 overflow-x-hidden overflow-y-auto rounded-md border border-border bg-surface p-1.5 shadow-md [&_.btn]:w-full [&_.btn]:justify-start [&_a.btn]:w-full [&_a.btn]:justify-start'

export const menuMaisPainelUp = 'top-auto bottom-[calc(100%+0.25rem)]'

export const menuMaisPainelStart = 'right-auto left-0'

export const acoesDesktop = 'flex flex-wrap gap-1.5 max-[720px]:hidden'

export const acoesMobile = 'hidden max-[720px]:flex max-[720px]:w-full max-[720px]:justify-end'

export const emailPassos =
  'mb-2 mt-0 pl-4 text-sm text-text [&_li]:mb-0.5 [&_li]:opacity-55 [&_li.is-ativo]:font-semibold [&_li.is-ativo]:opacity-100'

export const bannerTrial =
  'mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 rounded-sm border border-[color-mix(in_srgb,var(--trial)_22%,transparent)] bg-trial-bg px-2.5 py-1 text-[0.75rem] leading-snug max-[720px]:gap-1.5 [&_p]:m-0 [&_p]:flex-1 [&_p]:min-w-0 [&_.btn]:shrink-0 [&_.btn]:px-2 [&_.btn]:py-0.5 [&_.btn]:text-[0.7rem]'

export const itensCabecalho =
  'mb-2.5 flex flex-wrap items-center justify-between gap-2 [&_h2]:m-0 [&_a]:inline-flex [&_a]:items-center [&_a]:no-underline'

export const itensItem =
  `${listItem} items-start justify-start gap-2 max-[520px]:gap-2`

export const itensPreview =
  'size-10 shrink-0 overflow-hidden rounded-sm border border-border bg-transparent p-0 [&_img]:block [&_img]:size-full [&_img]:object-cover [&_span]:block [&_span]:size-full'

export const itensPreviewClicavel =
  `${itensPreview} cursor-zoom-in font-[inherit] text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text`

export const itensInfo = 'min-w-40 flex-1 max-[520px]:min-w-0 max-[520px]:flex-[1_1_100%]'

export const itensGridCampos = 'grid grid-cols-2 gap-2.5 max-[520px]:grid-cols-1'

export const assinaturaSecao = `${painelSecao} grid gap-3`

export const assinaturaIntro = 'm-0 text-sm opacity-80'

export const assinaturaLista = 'm-0 grid gap-2'

export const assinaturaListaItem = 'grid gap-[0.1rem]'

export const assinaturaDt =
  'm-0 text-[0.75rem] tracking-[0.02em] uppercase opacity-70'

export const assinaturaDd = 'm-0 text-sm'

export const assinaturaAviso = 'm-0 text-sm opacity-80'

export const assinaturaAcoes =
  'flex flex-wrap gap-1.5 max-[720px]:flex-col [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center'

export const assinaturaCarregando = 'm-0 text-sm opacity-75'

export const assinaturaFaturas = 'm-0 grid list-none gap-0 p-0'

export const assinaturaFatura =
  'flex flex-wrap items-center justify-between gap-2 border-t border-[color-mix(in_srgb,currentColor_12%,transparent)] py-2.5 last:border-b last:border-[color-mix(in_srgb,currentColor_12%,transparent)]'

export const assinaturaFaturaValor = 'm-0 text-sm font-semibold'

export const assinaturaFaturaMeta = 'mt-[0.15rem] mb-0 text-[0.8125rem] opacity-75'

export const assinaturaFaturaLinks =
  'flex flex-wrap gap-1 max-[720px]:w-full [&_.btn]:max-[720px]:flex-1 [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:flex-1 [&_a.btn]:max-[720px]:justify-center'

export const historicoLista = 'm-0 flex list-none flex-col gap-2 p-0'

export const historicoCard =
  'rounded-lg border border-border bg-surface px-3.5 py-3 shadow-sm'

export const historicoTopo =
  'flex flex-wrap items-start justify-between gap-2'

export const historicoData = 'm-0 text-[0.75rem] text-muted'

export const historicoNome =
  'mt-[0.1rem] mb-0.5 font-display text-[1.05rem] font-semibold'

export const historicoMeta = 'm-0 text-[0.8125rem] text-muted'

export const historicoAcoes =
  'flex flex-wrap gap-1 max-[520px]:w-full [&_.btn]:max-[520px]:flex-1 [&_.btn]:max-[520px]:justify-center'

export const historicoDetalhe = 'mt-3 border-t border-border pt-3'

export const historicoDl = 'mb-3 mt-0 grid gap-2'

export const historicoDlItem = 'grid gap-[0.1rem]'

export const historicoDt =
  'text-[0.7rem] font-medium tracking-[0.03em] text-muted uppercase'

export const historicoDd = 'm-0 text-sm [&_a]:text-accent'

export const historicoItens = 'm-0 flex list-none flex-col gap-1 p-0'

export const historicoItemLi =
  'flex flex-wrap gap-x-2 gap-y-1 text-[0.8125rem]'

export const historicoCat = 'font-medium text-muted after:content-[":"]'

export const historicoRodape = 'mt-1.5 mb-0 text-[0.8125rem] [&_a]:text-accent'
