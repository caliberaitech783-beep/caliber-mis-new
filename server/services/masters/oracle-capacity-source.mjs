import oracledb from 'oracledb';
import {validateCapacity} from '../../../shared/reports/production-report.mjs';
const identifier=value=>{if(!/^[A-Za-z][A-Za-z0-9_$#]*(?:\.[A-Za-z][A-Za-z0-9_$#]*)?$/.test(String(value||'')))throw Object.assign(Error('Configure a valid Oracle capacity table/view and column mapping.'),{status:409});return value};
export function capacitySourceQuery(env=process.env){
 if(!env.ORACLE_CAPACITY_VIEW)throw Object.assign(Error('Oracle OB Trip average mapping is not configured. Set ORACLE_CAPACITY_VIEW and ORACLE_CAPACITY_COLUMNS_JSON after confirming the source schema.'),{status:409});
 let columns;try{columns=JSON.parse(env.ORACLE_CAPACITY_COLUMNS_JSON||'{}')}catch{throw Object.assign(Error('Invalid Oracle capacity column mapping JSON.'),{status:409})}
 const fields={location:'LOCATION',make:'MAKE',model:'MODEL',capacity:'CAPACITY',averageDalaFactor:'AVERAGE_DALA_FACTOR',jobType:'JOB_TYPE',effectiveFrom:'EFFECTIVE_FROM'};
 return 'SELECT '+Object.entries(fields).map(([key,alias])=>identifier(columns[key])+' AS '+alias).join(', ')+' FROM '+identifier(env.ORACLE_CAPACITY_VIEW);
}
export function capacitySourceRows(rows){return rows.map(row=>validateCapacity({location:row.LOCATION,make:row.MAKE,model:row.MODEL,capacity:row.CAPACITY,averageDalaFactor:row.AVERAGE_DALA_FACTOR,jobType:row.JOB_TYPE,effectiveFrom:row.EFFECTIVE_FROM instanceof Date?row.EFFECTIVE_FROM.toISOString().slice(0,10):String(row.EFFECTIVE_FROM||'').slice(0,10),reason:'Oracle OB Trip average sync'}))}
export async function readOracleCapacities(env=process.env,config=null){
 const sql=capacitySourceQuery(env);
 const connectionConfig=config||{user:env.ORACLE_DB_USER,password:env.ORACLE_DB_PASSWORD,connectString:env.ORACLE_DB_CONNECT_STRING};
 if(!connectionConfig.user||!connectionConfig.password||!connectionConfig.connectString)throw Object.assign(Error('Configure the Oracle connection before syncing capacity.'),{status:409});
 const connection=await oracledb.getConnection({...connectionConfig,connectTimeout:15,transportConnectTimeout:10});
 try{connection.callTimeout=60000;await connection.execute('SET TRANSACTION READ ONLY');const result=await connection.execute(sql,{},{outFormat:oracledb.OUT_FORMAT_OBJECT,maxRows:10001});if(result.rows.length>10000)throw Error('Capacity source exceeds 10000 rows. No capacities were changed.');return capacitySourceRows(result.rows)}finally{await connection.close()}
}
