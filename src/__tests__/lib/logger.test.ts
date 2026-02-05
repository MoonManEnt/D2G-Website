import { describe, it, expect, beforeEach } from "@jest/globals";
const mc=jest.fn().mockReturnValue({info:jest.fn(),debug:jest.fn(),warn:jest.fn(),error:jest.fn()});
const mi=jest.fn();
const md=jest.fn();
const mp=jest.fn().mockReturnValue({child:mc,info:mi,debug:md,warn:jest.fn(),error:jest.fn()});
(mp as any).stdSerializers={err:jest.fn()};
jest.mock("pino",()=>({__esModule:true,default:mp}));
describe("Logger",()=>{
  beforeEach(()=>{jest.clearAllMocks();});
  function loadModule(){return require("@/lib/logger") as typeof import("@/lib/logger");}
  it("createLogger makes child",()=>{const m=loadModule();m.createLogger("test-mod");expect(mc).toHaveBeenCalledWith({module:"test-mod"});});
  it("createLogger different modules",()=>{const m=loadModule();m.createLogger("a");m.createLogger("b");expect(mc).toHaveBeenCalledWith({module:"a"});expect(mc).toHaveBeenCalledWith({module:"b"});});
  it("logApiRequest",()=>{const m=loadModule();m.logApiRequest("GET","/api/clients",200,45);expect(mi).toHaveBeenCalledWith(expect.objectContaining({method:"GET",path:"/api/clients",statusCode:200,durationMs:45,type:"api_request"}),expect.stringContaining("GET /api/clients 200 45ms"));});
  it("logDbQuery",()=>{const m=loadModule();m.logDbQuery("findMany","Client",12);expect(md).toHaveBeenCalledWith(expect.objectContaining({operation:"findMany",model:"Client",durationMs:12,type:"db_query"}),expect.stringContaining("DB findMany Client 12ms"));});
  it("logEmailSent masks email",()=>{const m=loadModule();m.logEmailSent("john@example.com","welcome",true);expect(mi).toHaveBeenCalledWith(expect.objectContaining({email:"jo***@example.com",category:"welcome",success:true,type:"email"}),expect.stringContaining("jo***@example.com"));});
  it("logEmailSent short email",()=>{const m=loadModule();m.logEmailSent("ab@test.com","reset",false);expect(mi).toHaveBeenCalledWith(expect.objectContaining({email:"ab***@test.com",success:false}),expect.any(String));});
  it("logEmailSent success msg",()=>{const m=loadModule();m.logEmailSent("u@t.com","inv",true);expect(mi).toHaveBeenCalledWith(expect.any(Object),expect.stringContaining("sent"));});
  it("logEmailSent failure msg",()=>{const m=loadModule();m.logEmailSent("u@t.com","inv",false);expect(mi).toHaveBeenCalledWith(expect.any(Object),expect.stringContaining("failed"));});
  it("SSN pattern xxx-xx-xxxx",()=>{const p=/\b\d{3}-\d{2}-\d{4}\b/g;expect("SSN 123-45-6789".replace(p,"[R]")).toBe("SSN [R]");});
  it("SSN pattern 9-digit",()=>{const p=/\b\d{9}\b/g;expect("SSN 123456789 x".replace(p,"[R]")).toBe("SSN [R] x");});
  it("CC pattern dashes",()=>{const p=/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;expect("Card: 4111-1111-1111-1111 x".replace(p,"[R]")).toBe("Card: [R] x");});
  it("CC pattern spaces",()=>{const p=/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;expect("Card: 4111 1111 1111 1111 x".replace(p,"[R]")).toBe("Card: [R] x");});
  it("CC no sep",()=>{const p=/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g;expect("Card: 4111111111111111 x".replace(p,"[R]")).toBe("Card: [R] x");});
  it("exports logger",()=>{const m=loadModule();expect(m.logger).toBeDefined();expect(m.logger.info).toBeDefined();expect(m.logger.child).toBeDefined();});

});
