// The template cabinet: each template is a classic script with the shared prelude.
import common from "./common.js?raw";
import courier from "./courier.js?raw";
import catcher from "./catcher.js?raw";
import runner from "./runner.js?raw";
import shooter from "./shooter.js?raw";
import maze from "./maze.js?raw";
import breaker from "./breaker.js?raw";
import stacker from "./stacker.js?raw";
import flyer from "./flyer.js?raw";

const RAW: Record<string, string> = { courier, catcher, runner, shooter, maze, breaker, stacker, flyer };

export const TEMPLATE_IDS = Object.keys(RAW);

export const TEMPLATE_SOURCES: Record<string, string> = Object.fromEntries(
  Object.entries(RAW).map(([id, src]) => [id, `${common}\n;\n${src}`]),
);
