/** Classes Tailwind compartilhadas do admin (tokens via @theme). */

export const painel =
  'mx-auto flex max-w-[720px] flex-col gap-7 px-6 pt-8 pb-12 max-[720px]:gap-5 max-[720px]:overflow-x-clip max-[720px]:px-4 max-[720px]:pt-5 max-[720px]:pb-[calc(2rem+env(safe-area-inset-bottom,0px))]'

export const painelHeader =
  'flex flex-wrap items-end justify-between gap-4 max-[720px]:flex-col max-[720px]:items-stretch'

export const painelEyebrow =
  'm-0 text-[0.8rem] font-medium tracking-[0.04em] text-muted uppercase'

export const painelTitulo =
  'mt-[0.2rem] mb-0 font-display text-[clamp(1.75rem,4vw,2.25rem)] font-semibold'

export const painelAcoes =
  'flex flex-wrap gap-2 max-[720px]:w-full [&_.btn]:max-[720px]:flex-1 [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:flex-1 [&_a.btn]:max-[720px]:justify-center'

export const painelSecao =
  'rounded-lg border border-border bg-surface p-6 shadow-sm max-[720px]:overflow-visible max-[720px]:p-4 [&_h2]:mx-0 [&_h2]:mt-0 [&_h2]:mb-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mx-0 [&_h3]:mt-0 [&_h3]:mb-3 [&_h3]:text-base [&_h3]:font-semibold'

export const painelForm = 'flex flex-col gap-[0.9rem]'

export const painelFormAcoes =
  'flex flex-wrap gap-2 max-[720px]:flex-col-reverse [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:w-full [&_a.btn]:max-[720px]:justify-center'

export const painelLogoPreview =
  'w-fit rounded-[10px] border border-border bg-surface-solid p-3 [&_img]:block [&_img]:max-h-12 [&_img]:w-auto [&_img]:object-contain'

export const field = 'flex flex-col gap-[0.35rem]'

export const fieldLabel = 'text-[0.8rem] font-medium text-muted'

export const fieldInput =
  'font-[inherit] rounded-sm border border-border bg-surface-solid px-[0.8rem] py-[0.65rem] text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent'

export const fieldDica = 'mt-[0.35rem] block text-[0.8rem] font-normal leading-[1.35] text-muted'

export const fieldErro = 'mt-[0.35rem] block text-[0.8rem] text-danger'

export const fieldSenha = 'relative'

export const fieldSenhaInput = `${fieldInput} box-border w-full pr-12`

export const fieldSenhaToggle =
  'absolute top-1/2 right-1 m-0 grid min-h-touch min-w-touch -translate-y-1/2 place-items-center rounded-sm border-none bg-transparent p-[0.35rem] leading-none text-muted cursor-pointer enabled:hover:text-accent disabled:cursor-not-allowed disabled:opacity-50'

export const list =
  'm-0 flex list-none flex-col gap-3 p-0'

export const listItem =
  'flex min-w-0 flex-wrap justify-between gap-3 overflow-visible rounded-md border border-border bg-surface-solid px-4 py-[0.9rem] [&_>div:first-child]:min-w-0 [&_>div:first-child]:flex-[1_1_10rem] [&_p]:mt-[0.35rem] [&_p]:mb-0 [&_p]:text-sm [&_p]:text-muted'

export const listAcoes =
  'flex flex-wrap items-start justify-end gap-[0.4rem] [&_a]:inline-flex [&_a]:items-center [&_a]:no-underline [&_.btn]:max-[720px]:px-[0.7rem] [&_.btn]:max-[720px]:text-[0.85rem]'

export const categoriasBadge =
  'ml-[0.35rem] inline-block align-middle rounded px-[0.45rem] py-[0.1rem] text-[0.65rem] font-semibold tracking-[0.04em] text-muted uppercase bg-surface-elevated'

export const categoriasQtd = 'text-[0.9em] font-normal text-muted'

export const categoriasId = 'mt-[0.15rem] block text-xs text-muted'

export const loginShell =
  'grid min-h-screen place-items-center px-5 py-8 max-[480px]:items-start max-[480px]:px-4 max-[480px]:pt-5 max-[480px]:pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]'

export const loginCard =
  'flex w-full max-w-96 flex-col gap-4 rounded-lg border border-border bg-surface px-7 py-8 shadow-md max-[480px]:px-[1.15rem] max-[480px]:py-[1.35rem]'

export const loginForm = 'flex flex-col gap-4'

export const loginHeaderTitulo =
  'm-0 font-display text-[2rem] font-semibold max-[480px]:text-[1.65rem]'

export const loginHeaderSub = 'mt-[0.35rem] mb-0 text-[0.95rem] text-muted'

export const loginRodape = 'm-0 text-center text-sm text-muted [&_a]:font-medium [&_a]:text-accent [&_a]:no-underline hover:[&_a]:underline'

export const loginSubmit = 'mt-1 w-full'

export const loginAvisoEmail =
  'mt-1 mb-0 rounded-md border border-success-border bg-success-bg px-4 py-[1.1rem] shadow-[0_0_0_3px_color-mix(in_srgb,var(--success)_12%,transparent)]'

export const loginAvisoEmailTitulo =
  'm-0 font-display text-[1.2rem] font-semibold leading-[1.25] text-success'

export const loginAvisoEmailTexto =
  'mt-2 mb-0 text-[0.95rem] font-medium leading-[1.45] text-success'

export const alertaStack = 'flex flex-col gap-3'

const alertaBase = 'm-0 rounded-md border px-[1.15rem] py-4'

export const alertaPorTipo: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: `${alertaBase} border-border bg-accent-bg`,
  success: `${alertaBase} border-success-border bg-success-bg`,
  warning: `${alertaBase} border-warning-border bg-warning-bg`,
  error: `${alertaBase} border-danger-border bg-danger-bg`,
}

export const alertaTitulo = 'mb-[0.55rem] text-[0.95rem] font-semibold'

export const alertaTituloPorTipo: Record<'info' | 'success' | 'warning' | 'error', string> = {
  info: alertaTitulo,
  success: `${alertaTitulo} text-success`,
  warning: `${alertaTitulo} text-warning`,
  error: `${alertaTitulo} text-danger`,
}

export const alertaCorpo =
  'm-0 text-[0.9rem] leading-[1.45] text-muted [&_p]:mb-2 [&_p]:mt-0 [&_p:last-child]:mb-0'

export const alertaCorpoErro = `${alertaCorpo} text-danger`

export const estado =
  'flex flex-col items-center justify-center gap-3 px-5 py-10 text-center text-muted [&_p]:m-0'

export const estadoVazio = `${estado} rounded-lg border border-dashed border-border bg-surface`

export const estadoTitulo = 'text-[1.05rem] font-semibold text-text'

export const estadoDesc = 'max-w-md text-[0.9rem]'

export const estadoSpinner =
  'size-6 animate-spin rounded-full border-2 border-border border-t-accent motion-reduce:animate-none motion-reduce:opacity-70'

export const skeleton = 'flex w-full flex-col gap-3'

export const skeletonLinha =
  'h-[3.25rem] animate-[shimmer_1.2s_ease-in-out_infinite] rounded-md bg-[linear-gradient(90deg,var(--surface-elevated)_0%,var(--border)_50%,var(--surface-elevated)_100%)] [background-size:200%_100%] motion-reduce:animate-none'

export const skeletonLinhaCurta = `${skeletonLinha} h-5 w-3/5`

export const breadcrumb = 'mb-3'

export const breadcrumbList =
  'm-0 flex list-none flex-wrap items-center gap-[0.35rem] p-0 text-[0.8rem] text-muted'

export const breadcrumbLink = 'text-accent no-underline hover:underline'

export const breadcrumbAtual = 'font-medium text-text'

export const modalBackdrop =
  'fixed inset-0 z-40 grid place-items-center bg-[rgba(26,36,33,0.45)] p-4 max-[720px]:items-end max-[720px]:pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'

export const modal =
  'w-[min(420px,100%)] rounded-lg border border-border bg-surface p-5 shadow-md max-[720px]:w-full max-[720px]:rounded-b-none [&_h2]:mb-2 [&_h2]:mt-0 [&_h2]:text-[1.15rem] [&_p]:mb-5 [&_p]:mt-0 [&_p]:text-[0.95rem] [&_p]:text-muted'

export const modalAcoes =
  'flex flex-wrap justify-end gap-[0.6rem] max-[720px]:flex-col-reverse max-[720px]:justify-stretch [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center'

export const menuMais = 'relative inline-block max-w-full w-max align-top'

export const menuMaisPainel =
  'absolute top-[calc(100%+0.35rem)] right-0 z-40 flex max-h-[min(70dvh,20rem)] min-w-48 max-w-[min(18rem,calc(100vw-1.5rem))] flex-col gap-1 overflow-x-hidden overflow-y-auto rounded-md border border-border bg-surface p-2 shadow-md [&_.btn]:w-full [&_.btn]:justify-start [&_a.btn]:w-full [&_a.btn]:justify-start'

export const menuMaisPainelUp = 'top-auto bottom-[calc(100%+0.35rem)]'

export const menuMaisPainelStart = 'right-auto left-0'

export const acoesDesktop = 'flex flex-wrap gap-[0.6rem] max-[720px]:hidden'

export const acoesMobile = 'hidden max-[720px]:flex max-[720px]:w-full max-[720px]:justify-end'

export const emailPassos =
  'mb-3 mt-0 pl-[1.1rem] text-text [&_li]:mb-1 [&_li]:opacity-55 [&_li.is-ativo]:font-semibold [&_li.is-ativo]:opacity-100'

export const bannerTrial =
  'mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-sm border border-[color-mix(in_srgb,var(--trial)_22%,transparent)] bg-trial-bg px-3 py-1.5 text-[0.8125rem] leading-snug max-[720px]:gap-2 [&_p]:m-0 [&_p]:flex-1 [&_p]:min-w-0 [&_.btn]:shrink-0 [&_.btn]:px-2.5 [&_.btn]:py-1 [&_.btn]:text-[0.75rem]'

export const itensCabecalho =
  'mb-4 flex flex-wrap items-center justify-between gap-3 [&_h2]:m-0 [&_a]:inline-flex [&_a]:items-center [&_a]:no-underline'

export const itensItem =
  `${listItem} items-start justify-start gap-[0.6rem] max-[520px]:gap-[0.6rem]`

export const itensPreview =
  'size-12 shrink-0 overflow-hidden rounded-sm border border-border bg-transparent p-0 [&_img]:block [&_img]:size-full [&_img]:object-cover [&_span]:block [&_span]:size-full'

export const itensPreviewClicavel =
  `${itensPreview} cursor-zoom-in font-[inherit] text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-text`

export const itensInfo = 'min-w-40 flex-1 max-[520px]:min-w-0 max-[520px]:flex-[1_1_100%]'

export const itensGridCampos =
  'grid grid-cols-2 gap-[0.9rem] max-[520px]:grid-cols-1'

export const assinaturaSecao = `${painelSecao} grid gap-4`

export const assinaturaIntro = 'm-0 opacity-80'

export const assinaturaLista = 'm-0 grid gap-3'

export const assinaturaListaItem = 'grid gap-[0.15rem]'

export const assinaturaDt =
  'm-0 text-[0.8rem] tracking-[0.02em] uppercase opacity-70'

export const assinaturaDd = 'm-0 text-base'

export const assinaturaAviso = 'm-0 opacity-80'

export const assinaturaAcoes =
  'flex flex-wrap gap-2 max-[720px]:flex-col [&_.btn]:max-[720px]:w-full [&_.btn]:max-[720px]:justify-center'

export const assinaturaCarregando = 'm-0 opacity-75'

export const assinaturaFaturas = 'm-0 grid list-none gap-3 p-0'

export const assinaturaFatura =
  'flex flex-wrap items-center justify-between gap-3 border-t border-[color-mix(in_srgb,currentColor_12%,transparent)] py-[0.85rem] last:border-b last:border-[color-mix(in_srgb,currentColor_12%,transparent)]'

export const assinaturaFaturaValor = 'm-0 font-semibold'

export const assinaturaFaturaMeta = 'mt-[0.2rem] mb-0 text-[0.9rem] opacity-75'

export const assinaturaFaturaLinks =
  'flex flex-wrap gap-[0.35rem] max-[720px]:w-full [&_.btn]:max-[720px]:flex-1 [&_.btn]:max-[720px]:justify-center [&_a.btn]:max-[720px]:flex-1 [&_a.btn]:max-[720px]:justify-center'

export const historicoLista = 'm-0 flex list-none flex-col gap-[0.85rem] p-0'

export const historicoCard =
  'rounded-lg border border-border bg-surface px-5 py-[1.1rem] shadow-sm'

export const historicoTopo =
  'flex flex-wrap items-start justify-between gap-[0.85rem]'

export const historicoData = 'm-0 text-[0.8rem] text-muted'

export const historicoNome =
  'mt-[0.15rem] mb-1 font-display text-[1.2rem] font-semibold'

export const historicoMeta = 'm-0 text-[0.9rem] text-muted'

export const historicoAcoes =
  'flex flex-wrap gap-[0.45rem] max-[520px]:w-full [&_.btn]:max-[520px]:flex-1 [&_.btn]:max-[520px]:justify-center'

export const historicoDetalhe = 'mt-4 border-t border-border pt-4'

export const historicoDl = 'mb-4 mt-0 grid gap-[0.65rem]'

export const historicoDlItem = 'grid gap-[0.15rem]'

export const historicoDt =
  'text-xs font-medium tracking-[0.03em] text-muted uppercase'

export const historicoDd = 'm-0 text-[0.95rem] [&_a]:text-accent'

export const historicoItens = 'm-0 flex list-none flex-col gap-[0.35rem] p-0'

export const historicoItemLi =
  'flex flex-wrap gap-x-[0.65rem] gap-y-[0.35rem] text-[0.9rem]'

export const historicoCat = 'font-medium text-muted after:content-[":"]'

export const historicoRodape = 'mt-2 mb-0 text-[0.9rem] [&_a]:text-accent'
