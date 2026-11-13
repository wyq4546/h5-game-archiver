export async function snapshot(page) {
  return page.evaluate(() => {
    const runtime = window.c3_runtimeInterface?._GetLocalRuntime?.();
    const layout = runtime?._layoutManager?._mainRunningLayout?.GetName?.();
    const variables = Object.fromEntries(runtime?._eventSheetManager?._allGlobalVars?.map(v => [v.GetName(), v.GetValue()]) || []);
    const ball = runtime?._objectClassesByName?.get('ball')?.GetInstances?.()[0];
    const cubes = runtime?._objectClassesByName?.get('cube')?.GetInstances?.().map(x => ({ x: x.GetWorldInfo().GetX(), y: x.GetWorldInfo().GetY(), frame: x._sdkInst?._currentFrameIndex })) || [];
    return { layout, variables, ball: ball ? { x: ball.GetWorldInfo().GetX(), y: ball.GetWorldInfo().GetY() } : null, cubes };
  });
}


