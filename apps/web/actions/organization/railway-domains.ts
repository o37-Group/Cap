type RailwayDnsRecord = {
	fqdn: string;
	zone: string;
	recordType: string;
	requiredValue: string;
	currentValue: string | null;
	status: string;
};

type RailwayDomain = {
	id: string;
	domain: string;
	status: {
		verified: boolean;
		certificateStatus: string;
		dnsRecords: RailwayDnsRecord[];
		verificationDnsHost: string | null;
		verificationToken: string | null;
	};
};

function railwayConfig() {
	const token = process.env.CAP_RAILWAY_PROJECT_TOKEN;
	const projectId = process.env.RAILWAY_PROJECT_ID;
	const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
	const serviceId = process.env.RAILWAY_SERVICE_ID;
	if (!token || !projectId || !environmentId || !serviceId) {
		throw new Error("Railway custom domains are not configured");
	}
	return { token, projectId, environmentId, serviceId };
}

async function railwayGraphql<T>(query: string, variables: object): Promise<T> {
	const { token } = railwayConfig();
	const response = await fetch("https://backboard.railway.com/graphql/v2", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Project-Access-Token": token,
		},
		body: JSON.stringify({ query, variables }),
		cache: "no-store",
	});
	if (!response.ok) throw new Error(`Railway returned HTTP ${response.status}`);
	const body = (await response.json()) as {
		data?: T;
		errors?: Array<{ message: string }>;
	};
	if (body.errors?.length || !body.data) {
		throw new Error(body.errors?.[0]?.message ?? "Railway returned no data");
	}
	return body.data;
}

const domainFields = `id domain status {
	verified certificateStatus verificationDnsHost verificationToken
	dnsRecords { fqdn zone recordType requiredValue currentValue status }
}`;

export async function getRailwayDomain(domain: string) {
	const { projectId, environmentId, serviceId } = railwayConfig();
	const data = await railwayGraphql<{
		domains: { customDomains: RailwayDomain[] };
	}>(
		`query Domains($projectId: String!, $environmentId: String!, $serviceId: String!) {
			domains(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId) {
				customDomains { ${domainFields} }
			}
		}`,
		{ projectId, environmentId, serviceId },
	);
	return data.domains.customDomains.find(
		(item) => item.domain.toLowerCase() === domain.toLowerCase(),
	);
}

export async function addRailwayDomain(domain: string) {
	const existing = await getRailwayDomain(domain);
	if (existing) return existing;
	const { projectId, environmentId, serviceId } = railwayConfig();
	const data = await railwayGraphql<{ customDomainCreate: RailwayDomain }>(
		`mutation CreateDomain($input: CustomDomainCreateInput!) {
			customDomainCreate(input: $input) { ${domainFields} }
		}`,
		{ input: { domain, projectId, environmentId, serviceId } },
	);
	return data.customDomainCreate;
}

export async function removeRailwayDomain(domain: string) {
	const existing = await getRailwayDomain(domain);
	if (!existing) return;
	await railwayGraphql<{ customDomainDelete: boolean }>(
		`mutation DeleteDomain($id: String!) { customDomainDelete(id: $id) }`,
		{ id: existing.id },
	);
}

export async function checkRailwayDomainStatus(domain: string) {
	const result = await getRailwayDomain(domain);
	if (!result) {
		return {
			verified: false,
			error: "Domain is not registered with Railway",
		};
	}
	const cname = result.status.dnsRecords.find((record) =>
		record.recordType.endsWith("CNAME"),
	);
	const aRecord = result.status.dnsRecords.find((record) =>
		record.recordType.endsWith("_A"),
	);
	const txtRecords = result.status.dnsRecords
		.filter((record) => record.recordType.endsWith("TXT"))
		.map((record) => ({
			type: "TXT",
			domain: record.fqdn,
			value: record.requiredValue,
			reason: "Verify domain ownership",
		}));
	if (
		result.status.verificationDnsHost &&
		result.status.verificationToken &&
		!txtRecords.length
	) {
		const zone = result.status.dnsRecords[0]?.zone;
		if (!zone) throw new Error("Railway did not return a DNS zone");
		txtRecords.push({
			type: "TXT",
			domain: `${result.status.verificationDnsHost}.${zone}`,
			value: result.status.verificationToken,
			reason: "Verify domain ownership",
		});
	}
	const verified =
		result.status.verified &&
		result.status.certificateStatus === "CERTIFICATE_STATUS_TYPE_VALID";
	return {
		verified,
		config: {
			name: domain,
			apexName: domain,
			dnsZone: result.status.dnsRecords[0]?.zone,
			verified,
			verification: txtRecords,
			recommendedCNAME: cname ? [{ rank: 1, value: cname.requiredValue }] : [],
			cnames:
				cname?.status === "DNS_RECORD_STATUS_PROPAGATED"
					? [cname.requiredValue]
					: cname?.currentValue
						? [cname.currentValue]
						: [],
			requiredAValue: aRecord?.requiredValue,
			currentAValues: aRecord?.currentValue ? [aRecord.currentValue] : [],
		},
		status: result,
	};
}
